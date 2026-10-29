// Turns text or an image into particle targets for the stage.
// World units: screen height = 2, centred on 0. Width = 2 * aspect.

export const PARTICLE_COUNT = 9000;

export interface Shape {
  pos: Float32Array;
  col: Float32Array;
}

export interface Layout {
  aspect: number;
  boxH: number; // max height of the shape in world units
  offsetX: number; // horizontal centre in world units
  offsetY: number; // vertical centre in world units
}

interface FitOptions extends Layout {
  minLum: number; // luminance floor for image pixels, 0 to 255
  zScale: number; // relief depth from luminance (portrait 3D)
  tint?: [number, number, number];
}

// Picks PARTICLE_COUNT pixels from the canvas, weighted by luminance.
function fromCanvas(canvas: HTMLCanvasElement, opt: FitOptions): Shape {
  const cw = canvas.width;
  const ch = canvas.height;
  const data = canvas.getContext('2d')!.getImageData(0, 0, cw, ch).data;
  const candidates: number[] = [];
  for (let i = 0; i < cw * ch; i++) {
    const o = i * 4;
    const lum = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
    if (data[o + 3] > 110 && lum >= opt.minLum) candidates.push(i);
  }
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  const col = new Float32Array(PARTICLE_COUNT * 3);
  if (candidates.length === 0) return { pos, col };

  const cAspect = cw / ch;
  const fitH = Math.min(opt.boxH, (2 * opt.aspect * 0.9) / cAspect);
  const fitW = fitH * cAspect;

  // Seeded picks so the same shape always forms the same way.
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let p = 0; p < PARTICLE_COUNT; p++) {
    const idx = candidates[Math.floor(rnd() * candidates.length)];
    const px = idx % cw;
    const py = Math.floor(idx / cw);
    const o = idx * 4;
    const lum = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    pos[p * 3] = opt.offsetX + (px / cw - 0.5) * fitW + (rnd() - 0.5) * 0.004;
    pos[p * 3 + 1] = opt.offsetY + (0.5 - py / ch) * fitH + (rnd() - 0.5) * 0.004;
    pos[p * 3 + 2] = lum * opt.zScale;
    if (opt.tint) {
      const k = 0.6 + 0.4 * lum;
      col[p * 3] = opt.tint[0] * k;
      col[p * 3 + 1] = opt.tint[1] * k;
      col[p * 3 + 2] = opt.tint[2] * k;
    } else {
      col[p * 3] = data[o] / 255;
      col[p * 3 + 1] = data[o + 1] / 255;
      col[p * 3 + 2] = data[o + 2] / 255;
    }
  }
  return { pos, col };
}

export function sampleText(text: string, layout: Layout): Shape {
  const c = document.createElement('canvas');
  c.width = 1600;
  c.height = 700;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.font = '900 430px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 800, 350, 1500);
  return fromCanvas(c, { ...layout, minLum: 0, zScale: 0, tint: [0.45, 0.92, 1] });
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    });
    imageCache.set(src, p);
  }
  return p;
}

// Draws an image to a bounded canvas, then samples it.
export async function sampleImage(
  src: string,
  layout: Layout,
  opts: { minLum: number; zScale: number },
  maxSide = 420,
): Promise<Shape> {
  const img = await loadImage(src);
  const scale = maxSide / Math.max(img.naturalWidth, img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return fromCanvas(c, { ...layout, ...opts });
}
