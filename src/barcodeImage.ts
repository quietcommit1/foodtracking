// Let the browser decode gallery formats (including formats unsupported by the WASM image
// loader), then pass bounded pixels to the barcode decoder. No image leaves the device.
export async function barcodeImage(file: File): Promise<ImageData> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error(
            'This photo format could not be opened. Choose a JPEG/PNG photo or a screenshot of the barcode.',
          ),
        );
      image.src = url;
    });
    const factor = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * factor));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context)
      throw new Error('Photo processing is unavailable. Enter the printed barcode digits below.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    image.src = '';
    URL.revokeObjectURL(url);
  }
}
