// Real image decoding with the same locally bundled WASM engine as the camera.
import { it, expect, beforeAll } from 'vitest';
import bwip from 'bwip-js/node';
import { readFileSync } from 'node:fs';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import { normalizeBarcode } from '../src/nutrition';
beforeAll(() => {
  prepareZXingModule({
    overrides: {
      wasmBinary: readFileSync('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'),
    },
  });
});
for (const fixture of [
  { format: 'ean13', text: '890123456789', expected: '8901234567890' },
  { format: 'ean8', text: '9638507', expected: '96385074' },
  { format: 'upca', text: '01234567890', expected: '0012345678905' },
  { format: 'upce', text: '04252614', expected: '0042100005264' },
])
  it(`decodes and normalizes a ${fixture.format} retail barcode fixture`, async () => {
    const buffer = await bwip.toBuffer({
      bcid: fixture.format,
      text: fixture.text,
      scale: 3,
      height: 30,
      includetext: false,
      paddingwidth: 30,
      paddingheight: 20,
      backgroundcolor: 'FFFFFF',
    });
    const results = await readBarcodes(new Uint8Array(buffer), {
      formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'],
      maxNumberOfSymbols: 1,
      tryHarder: true,
    });
    expect(results).toHaveLength(1);
    expect(
      normalizeBarcode(
        results[0].text,
        results[0].format === 'UPCE' && results[0].text.length === 8 ? 'UPC-E' : 'auto',
      ),
    ).toBe(fixture.expected);
  });
