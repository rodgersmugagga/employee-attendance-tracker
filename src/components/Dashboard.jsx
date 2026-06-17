import React, { useState, useEffect, useRef } from 'react';
import { getLogs, punchIn, punchOut, getMemos, updateFaceDescriptor, setStoredUser } from '../utils/storage';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import FaceVerificationModal from './FaceVerificationModal';

const Dashboard = ({ user, onLogout }) => {
  const [logs, setLogs] = useState([]);
  const [currentStatus, setCurrentStatus] = useState('Out');
  const [memos, setMemos] = useState([]);
  const [todayLog, setTodayLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [perfectWeek, setPerfectWeek] = useState(false);

  // Security & Biometrics
  const [verificationType, setVerificationType] = useState(null); // 'in' or 'out'
  const [locLoading, setLocLoading] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [faceError, setFaceError] = useState(null);
  const webcamRef = useRef(null);
  const BLUE_OX_OFFICE = { lat: -1.286389, lng: 36.817223 };

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setFaceApiLoaded(true);
      } catch (err) {
        console.error("FaceAPI Model Load Failure", err);
      }
    };
    loadModels();
    fetchLogs();
  }, [user.id]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const userLogs = await getLogs(user.id);
      const allMemos = await getMemos();
      setLogs(userLogs);
      setMemos(allMemos);

      // Check for Perfect Week (last 5 entries = On Time)
      const lastFive = userLogs.slice(0, 5);
      if (lastFive.length === 5 && lastFive.every(l => l.status === 'On Time')) {
        setPerfectWeek(true);
      }

      const today = new Date().toLocaleDateString();
      const todayEntry = userLogs.find(log => log.date === today);
      setTodayLog(todayEntry);
      if (todayEntry && !todayEntry.timeOut) {
        setCurrentStatus('In');
      } else {
        setCurrentStatus('Out');
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const startPunchInFlow = () => {
    setVerificationType('in');
  };

  const startPunchOutFlow = () => {
    setVerificationType('out');
  };

  const handlePunchVerification = async () => {
    setLocLoading(true);
    setFaceError(null);

    if (!faceapi) {
      alert("Biometric system still loading...");
      setLocLoading(false);
      return;
    }

    // 1. Capture current face
    const video = webcamRef.current.video;
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setFaceError("No face detected. Please look directly at the camera.");
      setLocLoading(false);
      return;
    }

    // 2. Recognition Logic
    if (!user.faceDescriptor) {
      // ENROLLMENT: Save first face print
      try {
        const updatedUser = await updateFaceDescriptor(user.id, detection.descriptor);
        setStoredUser(updatedUser); // Update local storage
        alert("Face enrolled successfully!");
      } catch (err) {
        console.error("Enrollment failed", err);
      }
    } else {
      // VERIFICATION: Compare with stored face print
      const storedDescriptor = new Float32Array(JSON.parse(user.faceDescriptor));
      const distance = faceapi.euclideanDistance(detection.descriptor, storedDescriptor);

      console.log("Face distance:", distance);
      if (distance > 0.55) { // 0.6 is default, 0.45 is strict
        setFaceError("Biometric Mismatch. Access Denied.");
        setLocLoading(false);
        return;
      }
    }

    // 3. Proceed to punch
    if (verificationType === 'in') await handlePunchIn();
    else await handlePunchOut();
  };

  const handlePunchOut = async () => {
    setLocLoading(true);

    const getCoords = () => new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
    });

    let coords = { latitude: null, longitude: null };
    try {
      const position = await getCoords();
      coords = position.coords;
    } catch (err) {
      console.warn('Location access denied or timed out', err);
    }

    const photo = webcamRef.current?.getScreenshot();
    const now = new Date();
    const timeOut = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      await punchOut({
        logId: todayLog.id,
        timeOut,
        outLat: coords.latitude,
        outLng: coords.longitude,
        outPhoto: photo
      });
      setCurrentStatus('Out');
      setVerificationType(null);
      fetchLogs();
    } catch (err) {
      console.error('Failed to punch out', err);
      alert('Verification failed. Please try again.');
    } finally {
      setLocLoading(false);
    }
  };

  const handlePunchIn = async () => {
    setLocLoading(true);

    const getCoords = () => new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
    });

    let coords = { latitude: null, longitude: null };
    let isOutOfBounds = false;

    try {
      const position = await getCoords();
      coords = position.coords;

      const distance = calculateDistance(
        coords.latitude, coords.longitude,
        BLUE_OX_OFFICE.lat, BLUE_OX_OFFICE.lng
      );
      if (distance > 100) isOutOfBounds = true;
    } catch (err) {
      console.warn('Location access denied or timed out', err);
      // If location fails, we flag as out of bounds by default for security
      isOutOfBounds = true;
    }

    const photo = webcamRef.current?.getScreenshot();

    const now = new Date();
    const timeIn = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString();

    const nineAM = new Date();
    nineAM.setHours(9, 0, 0, 0);
    const isLate = now > nineAM;

    try {
      const newLog = await punchIn({
        userId: user.id,
        userName: user.name,
        date,
        timeIn,
        status: isLate ? 'Late' : 'On Time',
        lat: coords.latitude,
        lng: coords.longitude,
        photo: photo,
        isOutOfBounds: isOutOfBounds
      });

      setTodayLog(newLog);
      setCurrentStatus('In');
      setVerificationType(null);
      fetchLogs();
    } catch (err) {
      console.error('Failed to punch in', err);
      alert('Verification failed. Please try again.');
    } finally {
      setLocLoading(false);
    }
  };

  const oldHandlePunchOut = async () => {
    // Legacy...
  };

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            Welcome, {user.name}
            {perfectWeek && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                style={{ fontSize: '1.2rem', background: 'gold', padding: '0.2rem 0.6rem', borderRadius: '12px', color: 'black', fontWeight: '800' }}
                title="Perfect Week Badge!"
              >
                🏆
              </motion.span>
            )}
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Blue Ox Kampus Employee</p>
        </div>
        <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Logout</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-card" style={{ height: 'fit-content' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Attendance</h3>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Current Status</p>
              <div style={{
                display: 'inline-block',
                padding: '0.5rem 1.5rem',
                borderRadius: '20px',
                background: currentStatus === 'In' ? 'hsla(140, 70%, 50%, 0.2)' : 'hsla(0, 0%, 100%, 0.1)',
                color: currentStatus === 'In' ? '#44ff44' : 'var(--text-muted)',
                fontWeight: '600'
              }}>
                {currentStatus === 'In' ? 'Checked In' : 'Checked Out'}
              </div>
            </div>

            {currentStatus === 'Out' ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={!todayLog && { boxShadow: ['0 0 0px var(--primary)', '0 0 15px var(--primary)', '0 0 0px var(--primary)'] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="btn-primary"
                style={{ width: '100%' }}
                onClick={startPunchInFlow}
                disabled={todayLog && todayLog.timeOut}
              >
                {todayLog && todayLog.timeOut ? 'Worked Today' : 'Punch In'}
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary"
                style={{ width: '100%', background: '#ff4444' }}
                onClick={startPunchOutFlow}
              >
                Punch Out
              </motion.button>
            )}

            {todayLog && (
              <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Arrival: <strong>{todayLog.timeIn}</strong></p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status: <strong style={{ color: todayLog.status === 'Late' ? '#ff4444' : '#44ff44' }}>{todayLog.status}</strong></p>
                {todayLog.timeOut && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Departure: <strong>{todayLog.timeOut}</strong></p>}
              </div>
            )}
          </div>

          {memos.length > 0 && (
            <div className="glass-card animate-fade-in" style={{ borderColor: 'var(--accent)', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--accent)', fontSize: '1.1rem' }}>Kampus Notices</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {memos.map(memo => (
                  <div key={memo.id} style={{ padding: '0.8rem', borderLeft: '3px solid var(--accent)', background: 'hsla(45, 100%, 50%, 0.05)', borderRadius: '0 8px 8px 0' }}>
                    <p style={{ fontSize: '0.9rem', marginBottom: '0.2rem', lineHeight: '1.4' }}>{memo.content}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>— {memo.author}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Recent Activity</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Date</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Time In</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Time Out</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '1rem' }}>{log.date}</td>
                    <td style={{ padding: '1rem' }}>{log.timeIn}</td>
                    <td style={{ padding: '1rem' }}>{log.timeOut || '-'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        color: log.status === 'Late' ? '#ff4444' : '#44ff44',
                        background: log.status === 'Late' ? 'rgba(255, 68, 68, 0.1)' : 'rgba(68, 255, 68, 0.1)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {verificationType && (
          <FaceVerificationModal
            verificationType={verificationType}
            user={user}
            webcamRef={webcamRef}
            faceApiLoaded={faceApiLoaded}
            faceError={faceError}
            locLoading={locLoading}
            onVerify={handlePunchVerification}
            onCancel={() => { setVerificationType(null); setFaceError(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
