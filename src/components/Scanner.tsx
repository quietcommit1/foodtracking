import { useEffect, useRef, useState } from 'react';
import { readBarcodes, prepareZXingModule, type ReadInputBarcodeFormat } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { Camera, ScanLine } from 'lucide-react';
import Modal from './Modal';
import { normalizeBarcode } from '../nutrition';
// Bundle the decoder locally; no CDN, image uploads, or API key.
prepareZXingModule({
  overrides: { locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path) },
});
export const retailFormats: ReadInputBarcodeFormat[] = ['EAN13', 'EAN8', 'UPCA', 'UPCE'];
export default function Scanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const locked = useRef(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState('');
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [format, setFormat] = useState('auto');
  const [active, setActive] = useState(true);
  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ownedStream: MediaStream | null = null;
    locked.current = false;
    if (!active) return;
    if (!window.isSecureContext || !navigator.mediaDevices) {
      setError(
        'Camera access requires HTTPS or localhost and a supported browser. Enter the barcode below.',
      );
      return;
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    async function frame() {
      if (disposed || locked.current) return;
      try {
        const v = video.current;
        if (v && v.readyState >= 2 && v.videoWidth && ctx) {
          const factor = Math.min(1, 1280 / v.videoWidth);
          canvas.width = Math.round(v.videoWidth * factor);
          canvas.height = Math.round(v.videoHeight * factor);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const results = await readBarcodes(ctx.getImageData(0, 0, canvas.width, canvas.height), {
            formats: retailFormats,
            maxNumberOfSymbols: 1,
            tryHarder: true,
          });
          if (results.length && !disposed && !locked.current) {
            const code = normalizeBarcode(
              results[0].text,
              results[0].format === 'UPCE' && results[0].text.length === 8 ? 'UPC-E' : 'auto',
            );
            locked.current = true;
            stop();
            setActive(false);
            onCode(code);
            return;
          }
        }
      } catch (e) {
        if (!disposed) {
          setError(`Decoder unavailable: ${(e as Error).message}. Use manual entry.`);
          stop();
          setActive(false);
          return;
        }
      }
      if (!disposed) timer = setTimeout(() => void frame(), 300);
    }
    async function start() {
      try {
        ownedStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: device
            ? { deviceId: { exact: device } }
            : { facingMode: { ideal: 'environment' } },
        });
        if (disposed) {
          ownedStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = ownedStream;
        video.current!.srcObject = ownedStream;
        await video.current!.play();
        const list = await navigator.mediaDevices.enumerateDevices();
        if (!disposed) {
          setDevices(list.filter((d) => d.kind === 'videoinput'));
          void frame();
        }
      } catch (e) {
        ownedStream?.getTracks().forEach((t) => t.stop());
        if (!disposed)
          setError(
            (e as Error).name === 'NotAllowedError'
              ? 'Camera permission was denied. Enable permission in browser settings, or enter the barcode.'
              : 'Could not start the camera. Try another camera or use manual entry.',
          );
      }
    }
    void start();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      ownedStream?.getTracks().forEach((t) => t.stop());
      if (streamRef.current === ownedStream) streamRef.current = null;
    };
  }, [device, active]);
  function submit() {
    if (locked.current) return;
    try {
      const code = normalizeBarcode(manual, format);
      locked.current = true;
      stop();
      setActive(false);
      onCode(code);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal title="Scan a barcode" onClose={onClose}>
      <p className="muted">
        Point your camera at the product barcode. Your camera stays on this device.
      </p>
      <div className="camera">
        <video ref={video} muted playsInline autoPlay />
        <div className="scan-frame">
          <ScanLine size={50} />
        </div>
        <span>EAN & UPC barcodes</span>
      </div>
      {devices.length > 1 && (
        <label>
          Camera
          <select
            value={device}
            onChange={(e) => {
              setError('');
              setDevice(e.target.value);
            }}
          >
            <option value="">Rear camera (preferred)</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className="secondary"
        onClick={() => {
          setError('');
          setActive(!active);
        }}
      >
        <Camera size={17} />
        {active ? 'Stop camera' : 'Start camera'}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label>
          Or enter barcode
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 8901234567890"
            autoComplete="off"
          />
        </label>
        <label>
          Barcode format
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="auto">EAN / UPC-A / GTIN</option>
            <option value="UPC-E">UPC-E (compressed 8 digits)</option>
          </select>
        </label>
        <button className="primary" type="submit">
          Look up product
        </button>
      </form>
    </Modal>
  );
}
