import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { getLogs, punchIn, punchOut, getMemos, updateFaceDescriptor, setStoredUser } from '../utils/storage';

const FaceVerificationModal = lazy(() => import('./FaceVerificationModal'));

const MODEL_URL = '/models';

const getCoords = () => new Promise((resolve, reject) => {
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    timeout: 8000,
    maximumAge: 30000,
    enableHighAccuracy: true,
  });
});

const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Dashboard = ({ user, onLogout }) => {
  const [logs, setLogs] = useState([]);
  const [currentStatus, setCurrentStatus] = useState('Out');
  const [memos, setMemos] = useState([]);
  const [todayLog, setTodayLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [perfectWeek, setPerfectWeek] = useState(false);
  const [verificationType, setVerificationType] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [faceApiLoading, setFaceApiLoading] = useState(false);
  const [faceApi, setFaceApi] = useState(null);
  const [faceError, setFaceError] = useState(null);
  const [faceDescriptor, setFaceDescriptor] = useState(user.faceDescriptor ?? null);
  const webcamRef = useRef(null);
  const faceApiPromiseRef = useRef(null);

  const loadDashboardData = useCallback(() => Promise.all([
    getLogs(user.id),
    getMemos(),
  ]), [user.id]);

  const applyDashboardData = useCallback((userLogs, allMemos) => {
    setLogs(userLogs);
    setMemos(allMemos);

    const lastFive = userLogs.slice(0, 5);
    setPerfectWeek(lastFive.length === 5 && lastFive.every((log) => log.status === 'On Time'));

    const today = new Date().toLocaleDateString();
    const todayEntry = userLogs.find((log) => log.date === today) ?? null;
    setTodayLog(todayEntry);
    setCurrentStatus(todayEntry && !todayEntry.timeOut ? 'In' : 'Out');
  }, []);

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [userLogs, allMemos] = await loadDashboardData();
      applyDashboardData(userLogs, allMemos);
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  }, [applyDashboardData, loadDashboardData]);

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      try {
        const [userLogs, allMemos] = await loadDashboardData();
        if (!cancelled) applyDashboardData(userLogs, allMemos);
      } catch (err) {
        console.error('Failed to fetch logs', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [applyDashboardData, loadDashboardData]);

  const loadFaceApi = useCallback(async () => {
    if (faceApiLoaded && faceApi) return faceApi;
    if (faceApiPromiseRef.current) return faceApiPromiseRef.current;

    setFaceApiLoading(true);
    setFaceError(null);

    faceApiPromiseRef.current = import('face-api.js')
      .then(async (api) => {
        await Promise.all([
          api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setFaceApi(api);
        setFaceApiLoaded(true);
        return api;
      })
      .catch((err) => {
        console.error('FaceAPI model load failure', err);
        setFaceError('Biometric models could not load. Check your connection and try again.');
        faceApiPromiseRef.current = null;
        return null;
      })
      .finally(() => {
        setFaceApiLoading(false);
      });

    return faceApiPromiseRef.current;
  }, [faceApi, faceApiLoaded]);

  const openVerification = (type) => {
    setVerificationType(type);
    setFaceError(null);
    setLocLoading(false);
    void loadFaceApi();
  };

  const handlePunchOut = async () => {
    if (!todayLog?.id) {
      setFaceError('No active attendance record was found.');
      setLocLoading(false);
      return;
    }

    setLocLoading(true);

    let coords = { latitude: null, longitude: null, accuracy: null };
    try {
      const position = await getCoords();
      coords = position.coords;
    } catch (err) {
      console.warn('Location access denied or timed out', err);
    }

    const outPhoto = webcamRef.current?.getScreenshot();
    const timeOut = formatTime(new Date());

    try {
      await punchOut({
        logId: todayLog.id,
        timeOut,
        outLat: coords.latitude,
        outLng: coords.longitude,
        outAccuracy: coords.accuracy,
        outPhoto,
      });
      setCurrentStatus('Out');
      setVerificationType(null);
      await refreshDashboard();
    } catch (err) {
      console.error('Failed to punch out', err);
      setFaceError('Punch out failed. Please try again.');
    } finally {
      setLocLoading(false);
    }
  };

  const handlePunchIn = async () => {
    setLocLoading(true);

    let coords = { latitude: null, longitude: null, accuracy: null };

    try {
      const position = await getCoords();
      coords = position.coords;
    } catch (err) {
      console.warn('Location access denied or timed out', err);
    }

    const photo = webcamRef.current?.getScreenshot();
    const now = new Date();
    const nineAM = new Date();
    nineAM.setHours(9, 0, 0, 0);

    try {
      const newLog = await punchIn({
        userId: user.id,
        userName: user.name,
        date: now.toLocaleDateString(),
        timeIn: formatTime(now),
        status: now > nineAM ? 'Late' : 'On Time',
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        photo,
      });

      setTodayLog(newLog);
      setCurrentStatus('In');
      setVerificationType(null);
      await refreshDashboard();
    } catch (err) {
      console.error('Failed to punch in', err);
      setFaceError('Punch in failed. Please try again.');
    } finally {
      setLocLoading(false);
    }
  };

  const handlePunchVerification = async () => {
    setLocLoading(true);
    setFaceError(null);

    const api = await loadFaceApi();
    if (!api) {
      setLocLoading(false);
      return;
    }

    const video = webcamRef.current?.video;
    if (!video || video.readyState < 2) {
      setFaceError('Camera is not ready yet.');
      setLocLoading(false);
      return;
    }

    const detection = await api
      .detectSingleFace(video, new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setFaceError('No face detected. Please look directly at the camera.');
      setLocLoading(false);
      return;
    }

    if (!faceDescriptor) {
      try {
        const updatedUser = await updateFaceDescriptor(user.id, detection.descriptor);
        setStoredUser(updatedUser);
        setFaceDescriptor(updatedUser.faceDescriptor);
      } catch (err) {
        console.error('Enrollment failed', err);
        setFaceError('Face enrollment failed. Please try again.');
        setLocLoading(false);
        return;
      }
    } else {
      const storedDescriptor = new Float32Array(JSON.parse(faceDescriptor));
      const distance = api.euclideanDistance(detection.descriptor, storedDescriptor);

      if (distance > 0.55) {
        setFaceError('Biometric mismatch. Access denied.');
        setLocLoading(false);
        return;
      }
    }

    if (verificationType === 'in') await handlePunchIn();
    else await handlePunchOut();
  };

  if (loading) {
    return (
      <main className="container page-shell">
        <div className="loading-card">Loading attendance...</div>
      </main>
    );
  }

  const hasWorkedToday = Boolean(todayLog?.timeOut);

  return (
    <main className="container page-shell animate-fade-in">
      <header className="page-header">
        <div className="page-heading">
          <h2 className="page-title">
            Welcome, {user.name}
            {perfectWeek && <span className="badge badge-award">Perfect week</span>}
          </h2>
          <p>Blue Ox Kampus Employee</p>
        </div>
        <button onClick={onLogout} className="btn-ghost">Logout</button>
      </header>

      <div className="dashboard-grid">
        <div className="dashboard-side">
          <section className="glass-card attendance-card">
            <h3>Attendance</h3>
            <div className="status-block">
              <p>Current Status</p>
              <span className={`status-pill ${currentStatus === 'In' ? 'is-in' : 'is-out'}`}>
                {currentStatus === 'In' ? 'Checked In' : 'Checked Out'}
              </span>
            </div>

            {currentStatus === 'Out' ? (
              <button
                className={`btn-primary full-width ${!todayLog ? 'pulse-cta' : ''}`}
                onClick={() => openVerification('in')}
                disabled={hasWorkedToday}
              >
                {hasWorkedToday ? 'Worked Today' : 'Punch In'}
              </button>
            ) : (
              <button
                className="btn-primary danger full-width"
                onClick={() => openVerification('out')}
              >
                Punch Out
              </button>
            )}

            {todayLog && (
              <div className="today-summary">
                <p>Arrival: <strong>{todayLog.timeIn}</strong></p>
                <p>
                  Status:{' '}
                  <strong className={todayLog.status === 'Late' ? 'text-danger' : 'text-success'}>
                    {todayLog.status}
                  </strong>
                </p>
                {todayLog.timeOut && <p>Departure: <strong>{todayLog.timeOut}</strong></p>}
              </div>
            )}
          </section>

          {memos.length > 0 && (
            <section className="glass-card notice-panel animate-fade-in">
              <h3>Kampus Notices</h3>
              <div className="memo-list">
                {memos.map((memo) => (
                  <article key={memo.id} className="memo-card">
                    <p>{memo.content}</p>
                    <small>{memo.author}</small>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <section className="glass-card table-card">
          <h3>Recent Activity</h3>
          <div className="table-wrap">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td data-label="Date">{log.date}</td>
                    <td data-label="Time In">{log.timeIn}</td>
                    <td data-label="Time Out">{log.timeOut || '-'}</td>
                    <td data-label="Status">
                      <span className={`status-tag ${log.status === 'Late' ? 'late' : 'on-time'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-state">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {verificationType && (
        <Suspense fallback={
          <div className="modal-backdrop">
            <section className="glass-card verification-card">
              <div className="spinner" />
              <p className="muted-text centered">Preparing verification...</p>
            </section>
          </div>
        }>
          <FaceVerificationModal
            verificationType={verificationType}
            user={{ ...user, faceDescriptor }}
            webcamRef={webcamRef}
            faceapi={faceApi}
            faceApiLoaded={faceApiLoaded}
            faceApiLoading={faceApiLoading}
            faceError={faceError}
            locLoading={locLoading}
            onVerify={handlePunchVerification}
            onCancel={() => {
              setVerificationType(null);
              setFaceError(null);
            }}
          />
        </Suspense>
      )}
    </main>
  );
};

export default Dashboard;
