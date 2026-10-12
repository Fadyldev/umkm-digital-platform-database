import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Create SVG Icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#92400e" />
      <stop offset="50%" stop-color="#78350f" />
      <stop offset="100%" stop-color="#451a03" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
  </defs>
  
  <!-- Rounded Background Container -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  
  <!-- Outer Ring Accent -->
  <circle cx="256" cy="256" r="216" fill="none" stroke="#f59e0b" stroke-width="6" opacity="0.4" />
  
  <!-- Coffee Cup Body -->
  <path d="M128 208 C128 336 176 384 256 384 C336 384 384 336 384 208 Z" fill="#ffffff" />
  
  <!-- Coffee Foam Surface -->
  <ellipse cx="256" cy="208" rx="128" ry="32" fill="#d97706" />
  <ellipse cx="256" cy="208" rx="112" ry="24" fill="#fef3c7" />
  <ellipse cx="256" cy="208" rx="96" ry="16" fill="#b45309" />
  
  <!-- Cup Handle -->
  <path d="M370 236 C426 236 448 268 448 304 C448 340 420 364 362 364" fill="none" stroke="#ffffff" stroke-width="32" stroke-linecap="round" />
  
  <!-- Saucer / Plate -->
  <ellipse cx="256" cy="416" rx="160" ry="24" fill="#fef3c7" opacity="0.9" />
  <ellipse cx="256" cy="416" rx="136" ry="16" fill="#fbbf24" opacity="0.6" />
  
  <!-- Aroma / Steam Lines -->
  <path d="M208 160 C200 128 224 104 216 72" fill="none" stroke="#fbbf24" stroke-width="18" stroke-linecap="round" opacity="0.85" />
  <path d="M256 152 C248 112 272 88 264 56" fill="none" stroke="#fde68a" stroke-width="20" stroke-linecap="round" opacity="0.9" />
  <path d="M304 160 C296 128 320 104 312 72" fill="none" stroke="#fbbf24" stroke-width="18" stroke-linecap="round" opacity="0.85" />
</svg>`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgIcon, 'utf-8');
console.log('✅ Created public/favicon.svg');

// Helper to draw a circle / rounded shape in PNG
function createPngIcon(size, isMaskable = false) {
  const png = new PNG({ width: size, height: size });
  const scale = size / 512;
  const cx = size / 2;
  const cy = size / 2;

  // Background color: #78350f (R:120, G:53, B:15)
  // Accent color: #d97706 (R:217, G:119, B:6)
  // Cup White: #ffffff (R:255, G:255, B:255)
  // Steam Gold: #fbbf24 (R:251, G:191, B:36)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const dx = (x - cx) / scale;
      const dy = (y - cy) / scale;

      // Base background: warm coffee gradient
      const factor = (y / size);
      const bgR = Math.round(146 - factor * 70); // 146 -> 76
      const bgG = Math.round(64 - factor * 35);  // 64 -> 29
      const bgB = Math.round(14 - factor * 8);   // 14 -> 6

      // Rounded rect boundary (corner radius = 110)
      let inside = true;
      if (!isMaskable) {
        const cornerR = 110;
        const cornerDx = Math.abs(dx) - (256 - cornerR);
        const cornerDy = Math.abs(dy) - (256 - cornerR);
        if (cornerDx > 0 && cornerDy > 0) {
          if (Math.hypot(cornerDx, cornerDy) > cornerR) {
            inside = false;
          }
        }
      }

      if (!inside) {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0; // transparent
        continue;
      }

      // Default pixel is background gradient
      let r = bgR;
      let g = bgG;
      let b = bgB;
      let a = 255;

      // Golden Ring
      const distFromCenter = Math.hypot(dx, dy);
      if (distFromCenter >= 210 && distFromCenter <= 218) {
        r = 245; g = 158; b = 11;
      }

      // Saucer: ellipse cy=160, rx=160, ry=24 -> y in [400..435]
      const saucerDy = (y / scale) - 416;
      const saucerDx = (x / scale) - 256;
      if (Math.hypot(saucerDx / 160, saucerDy / 24) <= 1.0) {
        r = 254; g = 243; b = 199;
      }

      // Handle: path from dx in [114..192], dy in [-20..108]
      const handleDx = (x / scale) - 370;
      const handleDy = (y / scale) - 300;
      const handleDist = Math.hypot(handleDx / 60, handleDy / 50);
      if (handleDist >= 0.7 && handleDist <= 1.2 && (x / scale) > 340) {
        r = 255; g = 255; b = 255;
      }

      // Cup body: between y 208 and 384
      const cupY = (y / scale);
      const cupX = (x / scale);
      if (cupY >= 208 && cupY <= 384) {
        const progress = (cupY - 208) / (384 - 208);
        const halfWidth = 128 - progress * progress * 48;
        if (Math.abs(cupX - 256) <= halfWidth) {
          r = 255; g = 255; b = 255;
        }
      }

      // Coffee foam surface: ellipse cy=208, rx=120, ry=28
      const foamDx = cupX - 256;
      const foamDy = cupY - 208;
      if (Math.hypot(foamDx / 120, foamDy / 28) <= 1.0) {
        r = 217; g = 119; b = 6; // amber coffee
        if (Math.hypot(foamDx / 96, foamDy / 20) <= 1.0) {
          r = 254; g = 243; b = 199; // creamy foam center
        }
      }

      // Steam lines
      if (cupY >= 50 && cupY <= 170) {
        const steam1X = 216 + Math.sin(cupY * 0.08) * 12;
        const steam2X = 256 + Math.sin(cupY * 0.07 + 1) * 14;
        const steam3X = 296 + Math.sin(cupY * 0.08 + 2) * 12;

        if (
          Math.abs(cupX - steam1X) <= 8 ||
          Math.abs(cupX - steam2X) <= 9 ||
          Math.abs(cupX - steam3X) <= 8
        ) {
          r = 251; g = 191; b = 36; // bright steam gold
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  return png;
}

const sizes = [
  { name: 'pwa-192x192.png', size: 192, maskable: false },
  { name: 'pwa-512x512.png', size: 512, maskable: false },
  { name: 'maskable-icon-512x512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
];

for (const { name, size, maskable } of sizes) {
  const png = createPngIcon(size, maskable);
  const outPath = path.join(publicDir, name);
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ Generated public/${name} (${size}x${size})`);
}

// Copy pwa-192x192 as favicon.png
fs.copyFileSync(path.join(publicDir, 'pwa-192x192.png'), path.join(publicDir, 'favicon.png'));
console.log('✅ Icons generation complete!');
