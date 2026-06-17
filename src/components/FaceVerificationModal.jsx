import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { motion } from 'framer-motion';

const accentColor = (type, error) => {
  if (error) return '#ff4444';
  return type === 'in' ? 'var(--primary)' : '#ff6600';
};

const FaceVerificationModal = ({
  verificationType,
  user,
  webcamRef,
  faceApiLoaded,
  faceError,
  locLoading,
  onVerify,
  onCancel,
}) => {
  const canvasRef = useRef(null);
  const [capturedSnap, setCapturedSnap] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const intervalRef = useRef(null);
  const accent = accentColor(verificationType, faceError);
  const isEnrolling = !user.faceDescriptor;

  // Run face detection loop once models are loaded and modal is open
  useEffect(() => {
    if (!faceApiLoaded) return;

    const runDetection = async () => {
      const video = webcamRef.current?.video;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
        .withFaceLandmarks();

      // Resize canvas to match video
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detection) {
        setFaceDetected(true);
        const resized = faceapi.resizeResults(detection, displaySize);
        const box = resized.detection.box;

        // Draw glowing bounding box
        const gradient = ctx.createLinearGradient(box.x, box.y, box.x + box.width, box.y + box.height);
        gradient.addColorStop(0, '#00e5ff');
        gradient.addColorStop(1, '#7c4dff');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 12;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Corner markers
        const cLen = 18;
        ctx.shadowBlur = 6;
        [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].forEach(([cx, cy], i) => {
          ctx.beginPath();
          ctx.moveTo(cx + (i % 2 === 0 ? 0 : -cLen), cy);
          ctx.lineTo(cx + (i % 2 === 0 ? cLen : 0), cy);
          ctx.moveTo(cx, cy + (i < 2 ? 0 : -cLen));
          ctx.lineTo(cx, cy + (i < 2 ? cLen : 0));
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();
        });

        // Score label
        const score = Math.round(detection.detection.score * 100);
        ctx.fillStyle = 'rgba(0,229,255,0.85)';
        ctx.fillRect(box.x, box.y - 22, 80, 20);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`Face ${score}%`, box.x + 4, box.y - 7);

        // Take a snapshot for the small preview (once)
        if (!capturedSnap) {
          const snap = webcamRef.current?.getScreenshot();
          if (snap) setCapturedSnap(snap);
        }
      } else {
        setFaceDetected(false);
      }
    };

    intervalRef.current = setInterval(runDetection, 200);
    return () => clearInterval(intervalRef.current);
  }, [faceApiLoaded, capturedSnap]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        className="glass-card"
        style={{ maxWidth: '520px', width: '100%', textAlign: 'center' }}
      >
        {/* Header */}
        <h3 style={{ marginBottom: '0.4rem', color: accent, letterSpacing: '0.05em' }}>
          {isEnrolling ? '🔐 Biometric Enrollment' : '🔍 Identity Verification'}
        </h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.2rem', fontSize: '0.85rem' }}>
          {isEnrolling
            ? 'First-time setup: we\'re capturing your unique face print.'
            : `Verifying identity for punch-${verificationType}.`}
        </p>

        {/* Camera + Canvas overlay */}
        <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', background: '#000', border: `2px solid ${accent}`, marginBottom: '1rem' }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            style={{ width: '100%', height: 'auto', display: 'block' }}
            videoConstraints={{ facingMode: 'user', width: 480, height: 360 }}
          />

          {/* Detection canvas drawn on top */}
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />

          {/* Scanning sweep animation */}
          {!faceDetected && faceApiLoaded && !faceError && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: '3px', background: 'linear-gradient(to right, transparent, #00e5ff, transparent)',
              animation: 'scan-sweep 2s ease-in-out infinite',
            }} />
          )}

          {/* Status chip */}
          <div style={{
            position: 'absolute', top: '10px', left: '10px',
            background: 'rgba(0,0,0,0.65)', padding: '3px 8px',
            borderRadius: '6px', fontSize: '0.68rem', fontFamily: 'monospace',
            color: faceError ? '#ff4444' : faceDetected ? '#00e5ff' : '#aaa',
            border: `1px solid ${faceError ? '#ff4444' : faceDetected ? '#00e5ff55' : '#333'}`,
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <span style={{
              display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
              background: faceError ? '#ff4444' : faceDetected ? '#00e5ff' : '#666',
              boxShadow: faceDetected ? '0 0 6px #00e5ff' : 'none',
            }} />
            {faceError ? 'ERROR' : !faceApiLoaded ? 'Loading AI…' : faceDetected ? 'Face Locked' : 'Scanning…'}
          </div>

          {/* Enrolment badge */}
          {isEnrolling && (
            <div style={{
              position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(255,215,0,0.3)', border: '1px solid #ffd700',
              padding: '3px 12px', borderRadius: '20px', fontSize: '0.7rem', color: '#ffd700', whiteSpace: 'nowrap',
            }}>
              ✨ Enrolling — first time only
            </div>
          )}
        </div>

        {/* Error message */}
        {faceError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'rgba(255,68,68,0.12)', border: '1px solid #ff4444', borderRadius: '8px', padding: '0.6rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#ff6666' }}
          >
            ⚠️ {faceError}
          </motion.div>
        )}

        {/* Bottom row: captured preview + buttons */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Small capture preview */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ width: '62px', height: '62px', borderRadius: '10px', overflow: 'hidden', border: `2px solid ${faceDetected ? '#00e5ff' : '#333'}`, background: '#111', position: 'relative' }}>
              {capturedSnap
                ? <img src={capturedSnap} alt="capture" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>👤</div>
              }
              {faceDetected && (
                <div style={{ position: 'absolute', bottom: '2px', right: '2px', background: '#00e5ff', borderRadius: '50%', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>✓</div>
              )}
            </div>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '3px' }}>Preview</p>
          </div>

          <button
            className="btn-primary"
            style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{ flex: 2, background: accent, fontSize: '0.85rem', opacity: locLoading ? 0.7 : 1 }}
            onClick={onVerify}
            disabled={locLoading}
          >
            {locLoading ? '⏳ Verifying…' : isEnrolling ? '📸 Capture & Enroll' : `✅ Punch ${verificationType === 'in' ? 'In' : 'Out'}`}
          </button>
        </div>
      </motion.div>

      <style>{`
        @keyframes scan-sweep {
          0%   { top: 0%; }
          50%  { top: 95%; }
          100% { top: 0%; }
        }
      `}</style>
    </motion.div>
  );
};

export default FaceVerificationModal;
