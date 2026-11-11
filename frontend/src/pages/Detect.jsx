
import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ImagePlus,
  Upload,
  ScanLine,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { predict, saveHistory } from '../api';
import { useNavigate } from 'react-router-dom';

export default function Detect() {
  const [inputFile, setInputFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [cow, setCow] = useState('');

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const navigate = useNavigate();

  // Release camera and image preview resources when appropriate.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  // Attach the camera stream after the video element has rendered.
  useEffect(() => {
    if (!camera || !videoRef.current || !streamRef.current) return;

    const videoElement = videoRef.current;
    videoElement.srcObject = streamRef.current;

    videoElement.play().catch((error) => {
      console.error('Camera preview error:', error);
      setErr('Camera opened, but the preview could not start. Please try again.');
    });
  }, [camera]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCamera(false);
  }

  async function openCamera() {
    setErr('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setErr(
        'Camera is unavailable. Open this app on localhost or HTTPS and allow camera access. You can upload an image instead.'
      );
      return;
    }

    try {
      // Stop any previous camera stream first.
      streamRef.current?.getTracks().forEach((track) => track.stop());

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = mediaStream;
      setCamera(true);
    } catch (error) {
      console.error('Camera error:', error);

      if (error.name === 'NotAllowedError') {
        setErr('Camera permission was denied. Allow camera access in your browser settings.');
      } else if (
        error.name === 'NotFoundError' ||
        error.name === 'DevicesNotFoundError'
      ) {
        setErr('No camera was found on this device. Please upload an image.');
      } else {
        setErr('Unable to open the camera. Check camera permissions or upload an image.');
      }
    }
  }

  function chooseFile(file) {
    setErr('');
    setResult(null);

    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
      setErr('Please select a JPG, JPEG or PNG image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErr('Image must be 10 MB or smaller.');
      return;
    }

    const newPreview = URL.createObjectURL(file);

    setInputFile(file);
    setPreview((oldPreview) => {
      if (oldPreview) URL.revokeObjectURL(oldPreview);
      return newPreview;
    });

    stopCamera();
  }

  function removeImage() {
    setInputFile(null);
    setPreview((oldPreview) => {
      if (oldPreview) URL.revokeObjectURL(oldPreview);
      return '';
    });
    setResult(null);
    setErr('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function capturePhoto() {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setErr('Camera is starting. Please wait a moment and try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');

    if (!context) {
      setErr('Unable to capture the photo. Please upload an image instead.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErr('Photo capture failed. Please try again.');
          return;
        }

        const photoFile = new File(
          [blob],
          `cow-${Date.now()}.jpg`,
          { type: 'image/jpeg' }
        );

        chooseFile(photoFile);
      },
      'image/jpeg',
      0.92
    );
  }

  async function runScreening() {
    if (!inputFile || busy) {
      if (!inputFile) setErr('Please capture or upload a cow image first.');
      return;
    }

    setBusy(true);
    setErr('');
    setResult(null);

    try {
      const data = await predict(inputFile);

      const item = {
        id: `LSD-${Date.now()}`,
        cow: cow.trim() || 'Cow not specified',
        timestamp: new Date().toISOString(),
        prediction: data.prediction || 'Unknown',
        confidence: data.confidence ?? null,
        message: data.message || '',
        image: preview,
      };

      try {
        await saveHistory(item);
        setResult(item);
      } catch (historyError) {
        console.error('History save failed:', historyError);
  setResult(item);
  setErr(
    'Screening completed, but the history could not be saved. Please check your connection and login.'
  );
}
    } catch (error) {
      console.error('Screening request failed:', error);

      setErr(
        `Unable to connect to the screening backend. ${error.message || 'Please try again later.'} Backend integration will be tested separately.`
      );
    } finally {
      setBusy(false);
    }
  }

  const resultLabel =
    result?.prediction === 'Infected'
      ? 'Needs veterinary review'
      : result?.prediction === 'Healthy'
        ? 'No signs detected by screening'
        : result?.prediction === 'Invalid Image'
          ? 'Invalid image'
          : result?.prediction || '';

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">AI-ASSISTED PRELIMINARY CHECK</span>
        <h1>Detect &amp; screen</h1>
        <p>
          Capture a photo or upload an image to request a preliminary model
          screening.
        </p>
      </div>

      <div className="notice">
        <AlertTriangle size={19} />
        <span>
          Use a clear, well-lit cow photo. Model results are not a confirmed
          diagnosis.
        </span>
      </div>

      <div className="detect-grid">
        <section className="card detect-card">
          <div className="card-head">
            <div>
              <h2>1. Add a cow image</h2>
              <p>Capture a new photo or upload an existing one.</p>
            </div>
            <span className="number">01</span>
          </div>

          <div className="source-grid">
            <button
              type="button"
              className="source"
              onClick={openCamera}
              disabled={busy}
            >
              <Camera />
              <b>Capture image</b>
              <small>Use your device camera</small>
            </button>

            <button
              type="button"
              className="source"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <ImagePlus />
              <b>Upload image</b>
              <small>JPG or PNG · Max 10 MB</small>
            </button>
          </div>

          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept="image/png,image/jpeg,.jpg,.jpeg"
            onChange={(event) => {
              chooseFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />

          {camera && (
            <div className="camera">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                aria-label="Live camera preview"
              />

              <div className="row">
                <button
                  type="button"
                  className="btn primary"
                  onClick={capturePhoto}
                >
                  <Camera size={17} />
                  Take photo
                </button>

                <button
                  type="button"
                  className="btn ghost"
                  onClick={stopCamera}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!camera && preview && (
            <div className="preview">
              <img src={preview} alt="Selected cattle image preview" />

              <div className="row preview-actions">
                <span>{inputFile?.name}</span>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={removeImage}
                  aria-label="Remove image"
                  title="Remove image"
                  disabled={busy}
                >
                  <X />
                </button>
              </div>

              <button
                type="button"
                className="btn ghost full"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <RefreshCw size={16} />
                Change image
              </button>
            </div>
          )}

          {!camera && !preview && (
            <button
              type="button"
              className="dropzone"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <Upload size={28} />
              <b>Click to browse files</b>
              <span>PNG or JPEG, up to 10 MB</span>
            </button>
          )}

          <label className="field cow-field">
            <span>Optional cow name / ID</span>
            <input
              value={cow}
              onChange={(event) => setCow(event.target.value)}
              placeholder="e.g. COW-014"
              disabled={busy}
            />
          </label>

          <button
            type="button"
            className="btn primary full"
            disabled={!inputFile || busy}
            onClick={runScreening}
          >
            {busy ? (
              <>
                <span className="spinner" />
                Screening…
              </>
            ) : (
              <>
                <ScanLine size={18} />
                Run screening
                <ArrowRight size={17} />
              </>
            )}
          </button>

          {!inputFile && !err && (
            <p className="field-hint">
              Select or capture an image to enable screening.
            </p>
          )}

          {err && (
            <div className="error" role="alert">
              <AlertTriangle size={17} />
              <span>{err}</span>
            </div>
          )}
        </section>

        <aside className="card side-card">
          <div className="scan-art">
            <ScanLine size={42} />
          </div>

          <h2>What happens next?</h2>

          {[
            [
              '1',
              'Image check',
              'The backend checks whether the image contains a cow.',
            ],
            [
              '2',
              'Model output',
              'The API returns its prediction and confidence if available.',
            ],
            [
              '3',
              'History record',
              'Successful responses are saved securely to your account.',
            ],
          ].map((step) => (
            <div className="mini-step" key={step[0]}>
              <span>{step[0]}</span>
              <div>
                <b>{step[1]}</b>
                <p>{step[2]}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>

      {result && (
        <section className="card result">
          <div className="result-head">
            <span className="result-icon">
              {result.prediction === 'Infected' ? (
                <AlertTriangle />
              ) : (
                <CheckCircle2 />
              )}
            </span>

            <div>
              <span className="eyebrow">SCREENING COMPLETE</span>
              <h2>{resultLabel}</h2>
              <p>{result.message}</p>
            </div>
          </div>

          <div className="result-grid">
            <div>
              <small>Timestamp</small>
              <b>{new Date(result.timestamp).toLocaleString()}</b>
            </div>

            <div>
              <small>Cow</small>
              <b>{result.cow}</b>
            </div>

            <div>
              <small>Model confidence</small>
              <b>
                {result.confidence == null
                  ? 'Not provided'
                  : `${Number(result.confidence).toFixed(2)}%`}
              </b>
            </div>
          </div>

          <p className="notice">
            AI output is preliminary. If you notice lesions or other concerning
            signs, contact a veterinarian.
          </p>

          <div className="row">
            <button
              type="button"
              className="btn primary"
              onClick={() => navigate('/app/history')}
            >
              View history
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                removeImage();
                setCow('');
                setResult(null);
              }}
            >
              Screen another
            </button>
          </div>
        </section>
      )}
    </div>
  );
}