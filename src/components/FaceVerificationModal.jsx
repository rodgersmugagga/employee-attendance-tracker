import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';

const accentColor = (type, error) => {
  if (error) return '#D96B0D';
  return type === 'in' ? 'var(--primary)' : 'var(--accent-strong)';
};

const FaceVerificationModal = ({
  verificationType,
  user,
  webcamRef,
  faceapi,
  faceApiLoaded,
  faceApiLoading,
  faceError,
  locLoading,
  onVerify,
  onCancel,
}) => {
  const canvasRef = useRef(null);
  const capturedSnapRef = useRef(null);
  const [capturedSnap, setCapturedSnap] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const accent = accentColor(verificationType, faceError);
  const isEnrolling = !user.faceDescriptor;

  useEffect(() => {
    if (!faceApiLoaded || !faceapi) return undefined;

    let stopped = false;
    let inFlight = false;

    const runDetection = async () => {
      const video = webcamRef.current?.video;
      const canvas = canvasRef.current;
      if (stopped || inFlight || !video || !canvas || video.readyState < 2) return;

      inFlight = true;
      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceLandmarks();

        if (stopped) return;

        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!detection) {
          setFaceDetected(false);
          return;
        }

        setFaceDetected(true);
        const resized = faceapi.resizeResults(detection, displaySize);
        const box = resized.detection.box;

        const gradient = ctx.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
        gradient.addColorStop(0, '#0044CC');
        gradient.addColorStop(1, '#F58220');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#F58220';
        ctx.shadowBlur = 10;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        const cornerLength = 18;
        ctx.shadowBlur = 5;
        [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].forEach(([cx, cy], index) => {
          ctx.beginPath();
          ctx.moveTo(cx + (index % 2 === 0 ? 0 : -cornerLength), cy);
          ctx.lineTo(cx + (index % 2 === 0 ? cornerLength : 0), cy);
          ctx.moveTo(cx, cy + (index < 2 ? 0 : -cornerLength));
          ctx.lineTo(cx, cy + (index < 2 ? cornerLength : 0));
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 3;
          ctx.stroke();
        });

        const score = Math.round(detection.detection.score * 100);
        ctx.fillStyle = 'rgba(255, 170, 92, 0.92)';
        ctx.fillRect(box.x, Math.max(0, box.y - 22), 80, 20);
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`Face ${score}%`, box.x + 4, Math.max(13, box.y - 7));

        if (!capturedSnapRef.current) {
          const snap = webcamRef.current?.getScreenshot();
          if (snap) {
            capturedSnapRef.current = snap;
            setCapturedSnap(snap);
          }
        }
      } finally {
        inFlight = false;
      }
    };

    runDetection();
    const intervalId = window.setInterval(runDetection, 700);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [faceApiLoaded, faceapi, webcamRef]);

  const statusLabel = faceError
    ? 'Error'
    : faceApiLoading || !faceApiLoaded
      ? 'Loading AI'
      : faceDetected
        ? 'Face locked'
        : 'Scanning';

  return (
    <div className="modal-backdrop">
      <section className="glass-card verification-card animate-fade-in">
        <div className="verification-header">
          <h3 style={{ color: accent }}>{isEnrolling ? 'Biometric Enrollment' : 'Identity Verification'}</h3>
          <p>
            {isEnrolling
              ? 'First-time setup captures your face print.'
              : `Verifying identity for punch ${verificationType}.`}
          </p>
        </div>

        <div className="verification-camera" style={{ borderColor: accent }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.6}
            videoConstraints={{ facingMode: 'user', width: 480, height: 360 }}
          />

          <canvas ref={canvasRef} />

          {!faceDetected && faceApiLoaded && !faceError && (
            <div className="scan-line" />
          )}

          <div className={`verification-status ${faceError ? 'error' : faceDetected ? 'ready' : ''}`}>
            <span />
            {statusLabel}
          </div>

          {isEnrolling && (
            <div className="enroll-badge">First time only</div>
          )}
        </div>

        {faceError && (
          <div className="verification-error">
            {faceError}
          </div>
        )}

        <div className="verification-actions">
          <div className="capture-preview">
            {capturedSnap
              ? <img loading="lazy" src={capturedSnap} alt="Captured face preview" />
              : <span>Face</span>
            }
            {faceDetected && <b aria-label="Face detected" />}
          </div>

          <button
            className="btn-primary secondary"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{ background: accent }}
            onClick={onVerify}
            disabled={locLoading || faceApiLoading || !faceApiLoaded}
            type="button"
          >
            {locLoading
              ? 'Verifying...'
              : isEnrolling
                ? 'Capture and Enroll'
                : `Punch ${verificationType === 'in' ? 'In' : 'Out'}`}
          </button>
        </div>
      </section>
    </div>
  );
};

export default FaceVerificationModal;
