import { it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Scanner from '../src/components/Scanner';
vi.mock('zxing-wasm/reader', () => ({
  prepareZXingModule: vi.fn(),
  readBarcodes: vi.fn().mockResolvedValue([]),
}));
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
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
