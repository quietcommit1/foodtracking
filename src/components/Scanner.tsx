import { useEffect, useRef, useState } from 'react';
import { readBarcodes, prepareZXingModule, type ReadInputBarcodeFormat } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { Camera } from 'lucide-react';
import Modal from './Modal';
import { barcodeImage } from '../barcodeImage';
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
  const [photoBusy, setPhotoBusy] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ownedStream: MediaStream | null = null;
    setHasTorch(false);
    setTorchOn(false);
    if (!active) return;
    locked.current = false;
    if (!window.isSecureContext || !navigator.mediaDevices) {
      setActive(false);
      setError(
        'Camera access requires HTTPS or localhost and a supported browser. Enter the barcode below.',
      );
      return;
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      setError('Camera image capture is unavailable. Try a barcode photo or manual entry.');
      setActive(false);
      return;
    }
    let misses = 0;
    async function frame() {
      if (disposed || locked.current) return;
      if (!ctx) {
        stop();
        setActive(false);
        return;
      }
      try {
        const v = video.current;
        if (v && v.readyState >= 2 && v.videoWidth && ctx) {
          // Keep small label bars sharp: scan a full-resolution centre strip, with a full-frame
          // pass every third attempt for barcodes outside the guide or turned vertically.
          const fullFrame = misses % 3 === 2;
          const sourceHeight = fullFrame ? v.videoHeight : Math.round(v.videoHeight * 0.55);
          const sourceY = Math.round((v.videoHeight - sourceHeight) / 2);
          const factor = Math.min(1, 1920 / v.videoWidth);
          canvas.width = Math.round(v.videoWidth * factor);
          canvas.height = Math.round(sourceHeight * factor);
          ctx.drawImage(
            v,
            0,
            sourceY,
            v.videoWidth,
            sourceHeight,
            0,
            0,
            canvas.width,
            canvas.height,
          );
          const results = await readBarcodes(ctx.getImageData(0, 0, canvas.width, canvas.height), {
            formats: retailFormats,
            maxNumberOfSymbols: 1,
            tryHarder: true,
            tryRotate: true,
            tryInvert: true,
          });
          misses++;
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
            ? { deviceId: { exact: device }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
        });
        if (disposed) {
          ownedStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = ownedStream;
        video.current!.srcObject = ownedStream;
        await video.current!.play();
        const track = ownedStream.getVideoTracks?.()[0];
        try {
          const capabilities = track?.getCapabilities?.() as
            (MediaTrackCapabilities & { focusMode?: string[]; torch?: boolean }) | undefined;
          if (!disposed) setHasTorch(!!capabilities?.torch);
          if (capabilities?.focusMode?.includes('continuous')) {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
            });
          }
        } catch {
          /* Optional focus controls must not prevent normal scanning. */
        }
        // Some mobile browsers allow camera access but deny device enumeration.
        const list = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!disposed) {
          setDevices(list.filter((d) => d.kind === 'videoinput'));
          void frame();
        }
      } catch (e) {
        ownedStream?.getTracks().forEach((t) => t.stop());
        if (!disposed) {
          setActive(false);
          setError(
            (e as Error).name === 'NotAllowedError'
              ? 'Camera permission was denied. Enable permission in browser settings, or enter the barcode.'
              : 'Could not start the camera. Try another camera or use manual entry.',
          );
        }
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
  async function toggleTorch() {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      setError('Flashlight could not be changed. Improve the room lighting instead.');
    }
  }
  async function scanPhoto(file?: File) {
    if (!file || photoBusy || locked.current) return;
    if (file.size > 20 * 1024 * 1024) {
      setError('Choose a photo smaller than 20 MB.');
      return;
    }
    locked.current = true;
    stop();
    setActive(false);
    setPhotoBusy(true);
    setError('');
    try {
      const results = await readBarcodes(await barcodeImage(file), {
        formats: retailFormats,
        maxNumberOfSymbols: 1,
        tryHarder: true,
        tryRotate: true,
        tryInvert: true,
      });
      if (!mounted.current) return;
      if (!results.length)
        throw Error(
          'No readable barcode in the photo. Take a sharper photo with all bars and white margins visible, or enter the printed digits.',
        );
      onCode(
        normalizeBarcode(
          results[0].text,
          results[0].format === 'UPCE' && results[0].text.length === 8 ? 'UPC-E' : 'auto',
        ),
      );
    } catch (e) {
      if (mounted.current) {
        locked.current = false;
        setError((e as Error).message);
      }
    } finally {
      if (mounted.current) setPhotoBusy(false);
    }
  }
  function submit() {
    if (locked.current || photoBusy) return;
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
        Use the rear camera and hold the complete barcode steady, with white space on both sides.
        Move back slightly if the bars look blurry. Images stay on this device.
      </p>
      <div className="camera" hidden={!active}>
        <video ref={video} muted playsInline autoPlay />
        <div className="scan-frame" />
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
        disabled={photoBusy}
        onClick={() => {
          setError('');
          setActive(!active);
        }}
      >
        <Camera size={17} />
        {active ? 'Stop camera' : 'Start camera'}
      </button>
      {hasTorch && active && (
        <button
          className="secondary"
          type="button"
          aria-pressed={torchOn}
          onClick={() => void toggleTorch()}
        >
          {torchOn ? 'Turn flashlight off' : 'Use flashlight'}
        </button>
      )}
      <label>
        Choose a barcode photo from gallery
        <input
          type="file"
          accept="image/*"
          disabled={photoBusy}
          onClick={() => {
            stop();
            setActive(false);
          }}
          onChange={(event) => {
            void scanPhoto(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <p className="small muted">
        Choose an existing photo from your gallery, or take a barcode photo. If live scanning
        struggles, take a close, sharp photo of just the barcode. The photo is decoded locally and
        never uploaded.
      </p>
      {photoBusy && <p role="status">Reading barcode photo…</p>}
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
        <button className="primary" type="submit" disabled={photoBusy}>
          Look up product
        </button>
      </form>
    </Modal>
  );
}
