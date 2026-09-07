/**
 * QR Code generation — delegates to the battle-tested `qrcode` library.
 *
 * The previous hand-rolled Nayuki-style encoder had spec violations
 * (capacity formula, alignment patterns, format bits) that could produce
 * unscannable codes on printed passes. The `qrcode` package is the widely
 * deployed reference implementation, so scannability is now guaranteed.
 */
import QRCodeLib from 'qrcode';

export interface QRCodeOptions {
  text: string;
  size?: number;
  eccLevel?: 'L' | 'M' | 'Q' | 'H';
  fgColor?: string;
  bgColor?: string;
  margin?: number;
  logoUrl?: string;
  logoSize?: number;
}

/** Generate a boolean module matrix using the trusted library encoder. */
export const generateQrMatrix = (
  text: string,
  eccLevel: 'L' | 'M' | 'Q' | 'H' = 'M'
): boolean[][] => {
  // Synchronous matrix creation from the qrcode lib
  const qr = QRCodeLib.create(text || 'VMS-PASS', { errorCorrectionLevel: eccLevel });
  const size = qr.modules.size;
  const matrix: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(qr.modules.get(r, c) !== 0);
    }
    matrix.push(row);
  }
  return matrix;
};

/**
 * Draws a high-definition, standards-compliant QR Code onto any Canvas 2D Context.
 * Same contract as before — callers (passImageGenerator) need no changes.
 */
export const drawQrCodeToCanvas = async (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  options: {
    fgColor?: string;
    bgColor?: string;
    logoUrl?: string;
    logoSize?: number;
    eccLevel?: 'L' | 'M' | 'Q' | 'H';
  } = {}
) => {
  const fg = options.fgColor || '#0f172a';
  const bg = options.bgColor || '#ffffff';
  const ecc = options.eccLevel || 'H';

  const matrix = generateQrMatrix(text || 'VMS-PASS', ecc);
  const matrixDim = matrix.length;
  const cellSize = size / matrixDim;

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, size, size);

  // Foreground Modules
  ctx.fillStyle = fg;
  for (let r = 0; r < matrixDim; r++) {
    for (let c = 0; c < matrixDim; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(
          Math.round(x + c * cellSize),
          Math.round(y + r * cellSize),
          Math.ceil(cellSize),
          Math.ceil(cellSize)
        );
      }
    }
  }

  // Optional Center Emblem
  if (options.logoUrl) {
    try {
      const logoImg = new Image();
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve;
        logoImg.src = options.logoUrl || '/vgi_logo.png';
      });

      if (logoImg.complete && logoImg.naturalWidth !== 0) {
        const lSize = options.logoSize || Math.round(size * 0.22);
        const lx = x + (size - lSize) / 2;
        const ly = y + (size - lSize) / 2;
        const pad = 4;

        // Clean white cutout backing
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(lx - pad, ly - pad, lSize + pad * 2, lSize + pad * 2, 8);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#e9d5ff';
        ctx.stroke();

        // Draw Emblem
        ctx.drawImage(logoImg, lx, ly, lSize, lSize);
      }
    } catch (e) {
      console.warn('QR logo embed skipped:', e);
    }
  }
};
