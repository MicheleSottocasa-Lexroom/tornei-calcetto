// Rasterizza public/icons/icon.svg nei PNG richiesti dalla PWA.
// Usa `sharp` se disponibile; in caso di errore genera dei PNG placeholder validi.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');
const svgPath = join(iconsDir, 'icon.svg');

// nome file -> dimensione (px, quadrato)
const targets = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'maskable-192.png': 192,
  'maskable-512.png': 512,
  'apple-touch-icon-180.png': 180,
  'badge-72.png': 72,
};

async function withSharp() {
  const { default: sharp } = await import('sharp');
  const svg = await readFile(svgPath);
  await Promise.all(
    Object.entries(targets).map(async ([name, size]) => {
      const buf = await sharp(svg, { density: 384 })
        .resize(size, size, { fit: 'contain', background: { r: 15, g: 76, b: 157, alpha: 1 } })
        .png()
        .toBuffer();
      await writeFile(join(iconsDir, name), buf);
      console.log(`  ✓ ${name} (${size}x${size})`);
    }),
  );
}

// Genera un PNG monocromatico valido (verde primario) senza dipendenze esterne.
// Utile come fallback se `sharp` non è installabile nell'ambiente.
function solidColorPng(size, rgb = [22, 163, 74]) {
  const zlib = require('node:zlib');
  const width = size;
  const height = size;

  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const [r, g, b] = rgb;
  const bytesPerPixel = 4;
  const rowLen = width * bytesPerPixel;
  const raw = Buffer.alloc((rowLen + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowLen + 1);
    raw[rowStart] = 0; // filter type none
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * bytesPerPixel;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
      raw[p + 3] = 255;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function withFallback() {
  const { createRequire } = await import('node:module');
  globalThis.require = createRequire(import.meta.url);
  await Promise.all(
    Object.entries(targets).map(async ([name, size]) => {
      await writeFile(join(iconsDir, name), solidColorPng(size));
      console.log(`  ✓ ${name} (${size}x${size}) [placeholder]`);
    }),
  );
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  console.log('Generazione icone PWA da icon.svg…');
  try {
    await withSharp();
    console.log('Fatto (sharp).');
  } catch (err) {
    console.warn('sharp non disponibile, uso PNG placeholder:', err?.message ?? err);
    await withFallback();
    console.log('Fatto (placeholder).');
  }
}

main().catch((err) => {
  console.error('Generazione icone fallita:', err);
  process.exit(1);
});
