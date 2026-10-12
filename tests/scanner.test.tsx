import { it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Scanner from '../src/components/Scanner';
import { barcodeImage } from '../src/barcodeImage';
vi.mock('../src/barcodeImage', () => ({
  barcodeImage: vi
    .fn()
    .mockResolvedValue({ width: 100, height: 50, data: new Uint8ClampedArray(20000) }),
}));
vi.mock('zxing-wasm/reader', () => ({
  prepareZXingModule: vi.fn(),
  readBarcodes: vi.fn().mockResolvedValue([]),
}));
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as any);
});
it('handles unsupported camera environments and manual UPC-E fallback', () => {
  Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
  const onCode = vi.fn();
  render(<Scanner onCode={onCode} onClose={vi.fn()} />);
  expect(screen.getByText(/Camera access requires HTTPS/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('Or enter barcode'), { target: { value: '04252614' } });
  fireEvent.change(screen.getByLabelText('Barcode format'), { target: { value: 'UPC-E' } });
  fireEvent.click(screen.getByRole('button', { name: 'Look up product' }));
  expect(onCode).toHaveBeenCalledExactlyOnceWith('0042100005264');
});
it('reports permission denial', async () => {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
    },
    configurable: true,
  });
  render(<Scanner onCode={vi.fn()} onClose={vi.fn()} />);
  await screen.findByText(/Camera permission was denied/);
});
it('stops tracks even if camera permission finishes after unmount', async () => {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  let resolve!: (s: any) => void;
  const stopped = vi.fn();
  const promise = new Promise((r) => (resolve = r));
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockReturnValue(promise) },
    configurable: true,
  });
  const { unmount } = render(<Scanner onCode={vi.fn()} onClose={vi.fn()} />);
  unmount();
  resolve({ getTracks: () => [{ stop: stopped }] });
  await waitFor(() => expect(stopped).toHaveBeenCalledOnce());
});

it('photo fallback passes decoded pixels and reports one barcode', async () => {
  Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
  const { readBarcodes } = await import('zxing-wasm/reader');
  vi.mocked(readBarcodes).mockResolvedValueOnce([
    { text: '8906133020187', format: 'EAN13' },
  ] as any);
  const onCode = vi.fn();
  render(<Scanner onCode={onCode} onClose={vi.fn()} />);
  const file = new File([new Uint8Array([1, 2, 3])], 'barcode.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText('Choose a barcode photo from gallery'), {
    target: { files: [file] },
  });
  await waitFor(() => expect(onCode).toHaveBeenCalledExactlyOnceWith('8906133020187'));
  expect(vi.mocked(barcodeImage).mock.lastCall?.[0]).toBe(file);
  expect(vi.mocked(readBarcodes).mock.lastCall?.[0]).toMatchObject({ width: 100, height: 50 });
});

it('camera enumeration failure does not block decoding or track cleanup', async () => {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  const draw = vi.fn();
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({
    drawImage: draw,
    getImageData: vi
      .fn()
      .mockReturnValue({ width: 1920, height: 594, data: new Uint8ClampedArray() }),
  } as any);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(2);
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1920);
  vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(1080);
  const stop = vi.fn();
  const getUserMedia = vi
    .fn()
    .mockResolvedValue({ getTracks: () => [{ stop }], getVideoTracks: () => [] });
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia, enumerateDevices: vi.fn().mockRejectedValue(Error('unsupported')) },
    configurable: true,
  });
  const { readBarcodes } = await import('zxing-wasm/reader');
  vi.mocked(readBarcodes).mockResolvedValueOnce([
    { text: '8906133020187', format: 'EAN13' },
  ] as any);
  const onCode = vi.fn();
  const { unmount } = render(<Scanner onCode={onCode} onClose={vi.fn()} />);
  await waitFor(() => expect(onCode).toHaveBeenCalledExactlyOnceWith('8906133020187'));
  expect(getUserMedia.mock.lastCall?.[0].video).toMatchObject({
    width: { ideal: 1920 },
    facingMode: { ideal: 'environment' },
  });
  expect(draw).toHaveBeenCalled();
  expect(stop).toHaveBeenCalled();
  unmount();
});

it('does not request camera permission when canvas capture is unavailable', () => {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  const getUserMedia = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  render(<Scanner onCode={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByText(/Camera image capture is unavailable/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Start camera' })).toBeVisible();
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(document.querySelector('.camera')).not.toBeVisible();
});
