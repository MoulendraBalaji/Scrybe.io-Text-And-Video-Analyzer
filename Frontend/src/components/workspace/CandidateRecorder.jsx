/* ============================================================
   CandidateRecorder — camera + mic capture for the public
   candidate flow. getUserMedia → MediaRecorder → one webm File,
   exactly like an upload the same engine already understands.
   Consent is handled by the parent before this renders.
   ============================================================ */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

export function CandidateRecorder({ onRecorded, onCancel }) {
  const videoRef = useRef(null);
  const playbackRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const [streamActive, setStreamActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [recordedFile, setRecordedFile] = useState(null);
  const [error, setError] = useState(null);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      setStreamActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setError('Camera or microphone access is required to record. Grant permission and try again.');
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
  }, []);

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setTimer(0);
    try {
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm',
      });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `scrybe-response-${Date.now()}.webm`, { type: 'video/webm' });
        setRecordedFile(file);
        setRecordedUrl(URL.createObjectURL(blob));
        stopCamera();
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
    } catch {
      setError('This browser does not support recording here. Please upload a pre-recorded video instead.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  useEffect(() => {
    if (!recording) return undefined;
    const iv = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [recording]);

  useEffect(() => () => {
    stopCamera();
  }, [stopCamera]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="cand-rec">
      {error && (
        <div role="alert" className="cand-rec__error">{error}</div>
      )}

      {!recordedUrl && (
        <div className="cand-rec__stage">
          <video
            ref={videoRef}
            className="cand-rec__video"
            autoPlay
            playsInline
            muted
            style={{ background: 'var(--clay-surface-alt)' }}
          />

          <div className="cand-rec__controls">
            {!streamActive ? (
              <>
                <Button onClick={startCamera}><Icon name="Camera" size={16} /> Start camera</Button>
                <Button variant="ghost" onClick={onCancel}>Use file upload instead</Button>
              </>
            ) : !recording ? (
              <>
                <Button variant="primary" onClick={startRecording}><Icon name="Mic" size={16} /> Start recording</Button>
                <Button variant="ghost" onClick={stopCamera}>Cancel</Button>
              </>
            ) : (
              <Button variant="danger" onClick={stopRecording}>
                <Icon name="Stop" size={16} /> Stop ({fmt(timer)})
              </Button>
            )}
          </div>
        </div>
      )}

      {recordedUrl && (
        <div className="cand-rec__review">
          <video ref={playbackRef} src={recordedUrl} controls className="cand-rec__video" />
          <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>Preview your recording — re-record if you're not happy.</p>
          <div className="cand-rec__controls">
            <Button variant="primary" onClick={() => onRecorded(recordedFile)}>
              <Icon name="Check" size={16} /> Submit for scoring
            </Button>
            <Button variant="ghost" onClick={() => { setRecordedUrl(null); setRecordedFile(null); }}>
              <Icon name="Stop" size={15} /> Re-record
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
