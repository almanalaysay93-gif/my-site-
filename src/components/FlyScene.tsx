import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { projects } from '@/lib/projects';
import { asset } from '@/lib/asset';
import { PARTICLE_COUNT, SMALL_SCREEN, sampleImage, sampleText, type Layout, type Shape } from '@/lib/sample';

export interface FlyHandle {
  flyTo: (page: number) => void;
}

// Pages: 0 hero, 1..N projects, N+1 contact, N+2 booking.
const N = projects.length;
export const PAGE_COUNT = N + 3;

const PANEL_W = 16;
const PANEL_H = 9;
const SHAPE_SCALE = PANEL_H / 2; // sample shapes are 2 units tall
const SPACING = 18;

const FLIGHT_MS = SMALL_SCREEN ? 620 : 1100; // phones fly faster
const HOLD_MS = 0; // no hold: the burst and the reveal start as the camera lands
const REVEAL_MS = SMALL_SCREEN ? 360 : 600;
const VIDEO_OPACITY = 1; // full opacity: anything lower turns white sites grey

// Wide aspect so the sampled image fills the full panel width.
const SHAPE_LAYOUT: Layout = { aspect: 16 / 9 / 0.9, boxH: 2, offsetX: 0, offsetY: 0 };

// Each page sits on a gentle curve along -Z, so the flight banks left and right.
function pagePos(k: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(k * 1.3) * 5, Math.cos(k * 0.9) * 1.6, -k * SPACING);
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const shapeCache = new Map<number, Promise<Shape>>();
// Resolved shapes, so the scroll-out can place particles on the outgoing image without waiting.
const shapeResolved = new Map<number, Shape>();
function shapeFor(k: number): Promise<Shape> {
  let p = shapeCache.get(k);
  if (p) return p;
  if (k === 0) {
    p = sampleImage(asset('/portrait.jpg'), SHAPE_LAYOUT, { minLum: 42, zScale: 0.35 });
  } else if (k <= N) {
    const proj = projects[k - 1];
    p = proj.walk
      ? sampleImage(asset(`/walk/${proj.id}.jpg`), SHAPE_LAYOUT, { minLum: 12, zScale: 0 })
      : proj.shot
        ? sampleImage(asset(proj.shot), SHAPE_LAYOUT, { minLum: 12, zScale: 0 })
        : Promise.resolve(sampleText(proj.title, SHAPE_LAYOUT));
  } else {
    p = Promise.resolve(sampleText(k === N + 1 ? 'ALAi' : 'BOOK', SHAPE_LAYOUT));
  }
  p.then((shape) => shapeResolved.set(k, shape)).catch(() => undefined);
  shapeCache.set(k, p);
  return p;
}

// Poster for a panel without a walkthrough: the title on a dark card.
function titleTexture(title: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 720;
  const g = c.getContext('2d')!;
  g.fillStyle = '#05070d';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#eaf4ff';
  g.font = '700 84px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(title, 640, 330, 1180);
  g.fillStyle = '#8fa6c4';
  g.font = '400 36px system-ui, sans-serif';
  g.fillText('Under NDA. Details on request.', 640, 430);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft round dot: bright core with a falloff halo, so each particle glows.
function glowDotTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Halo for the video frame: a blurred ice-blue rounded rectangle that fades outward.
function frameGlowTexture(w: number, h: number, pad: number): THREE.CanvasTexture {
  const scale = 40; // canvas pixels per world unit
  const c = document.createElement('canvas');
  c.width = Math.round((w + pad) * scale);
  c.height = Math.round((h + pad) * scale);
  const g = c.getContext('2d')!;
  const x = (pad / 2) * scale;
  const y = (pad / 2) * scale;
  // One faint stroke with a wide soft blur: a low halo, not a neon tube.
  g.shadowColor = 'rgba(143,220,255,0.6)';
  g.shadowBlur = pad * scale * 0.35;
  g.strokeStyle = 'rgba(191,234,255,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.rect(x, y, w * scale, h * scale);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Panel {
  mesh: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
  edgeMat: THREE.LineBasicMaterial;
  mat: THREE.MeshBasicMaterial;
  poster: THREE.Texture;
  walk: boolean;
  src: string;
  video: HTMLVideoElement | null;
  vtex: THREE.VideoTexture | null;
}

interface Tween {
  t0: number;
  dur: number;
  fn: (e: number) => void;
  token: number;
}

const FlyScene = forwardRef<FlyHandle, { className?: string }>(function FlyScene({ className }, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const flyRef = useRef<((page: number) => void) | null>(null);

  useImperativeHandle(ref, () => ({ flyTo: (page) => flyRef.current?.(page) }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flightMs = reduced ? 1 : FLIGHT_MS;

    // Phones render at 1x pixel density with no anti-aliasing: a 3x screen would otherwise draw 9x the pixels.
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !SMALL_SCREEN, powerPreference: 'high-performance' });
    renderer.setPixelRatio(SMALL_SCREEN ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x020308, 24, 70);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(22.5));

    // Distance that fits a panel to about 62% of the height and 88% of the width.
    const viewDistance = () => {
      // Phones (portrait): fit the width so the walkthrough fills the screen; desktop keeps the height fit.
      const portrait = camera.aspect < 1;
      const byH = portrait ? 0 : PANEL_H / 0.62 / (2 * tanHalf);
      const byW = PANEL_W / (portrait ? 0.98 : 0.88) / (2 * tanHalf * camera.aspect);
      return Math.max(byH, byW);
    };
    const camFor = (k: number) => pagePos(k).add(new THREE.Vector3(0, 0, viewDistance()));

    // Hero particles sit beside the hero text: right side on wide screens, above it on phones.
    const heroCentre = () => {
      const p = pagePos(0);
      const halfH = viewDistance() * tanHalf;
      if (camera.aspect > 1.1) p.x += halfH * camera.aspect * 0.45;
      else p.y += halfH * 0.34;
      return p;
    };
    // On phones the hero shape shrinks to fit the gap between the contact grid and the text.
    const heroScale = () => (camera.aspect > 1.1 ? 1 : (0.18 * 2 * viewDistance() * tanHalf) / PANEL_H);

    /* ── star tunnel: gives depth to the flight ── */
    const STARS = SMALL_SCREEN ? 1000 : 3500;
    const starPos = new Float32Array(STARS * 3);
    const zFar = -(PAGE_COUNT * SPACING + 40);
    for (let i = 0; i < STARS; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 9 + Math.random() * 40;
      starPos[i * 3] = Math.cos(a) * r;
      starPos[i * 3 + 1] = Math.sin(a) * r * 0.6;
      starPos[i * 3 + 2] = 40 + Math.random() * (zFar - 40);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    // Every point is a soft round glow, not a hard square.
    const dotTex = glowDotTexture();
    const starMat = new THREE.PointsMaterial({
      color: 0x8fdcff,
      size: 0.32,
      map: dotTex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    /* ── panels: one per project. Hidden until their own reveal, so no empty boxes show in transit. ── */
    const loader = new THREE.TextureLoader();
    const panelGeo = new THREE.PlaneGeometry(PANEL_W, PANEL_H, 64, 36);
    const edgeGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(PANEL_W, PANEL_H));

    // Video surface follows the pointer: a bulge under the cursor and a soft ripple travelling out from it.
    const warp = { uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uBulge: { value: 0 }, uTime: { value: 0 } };
    const addWarp = (m: THREE.MeshBasicMaterial) => {
      m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, warp);
        shader.vertexShader =
          'uniform vec2 uMouse;\nuniform float uBulge;\nuniform float uTime;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vec2 pUv = position.xy / vec2(${PANEL_W.toFixed(1)}, ${PANEL_H.toFixed(1)}) + 0.5;
            vec2 dUv = (pUv - uMouse) * vec2(${(PANEL_W / PANEL_H).toFixed(3)}, 1.0);
            float dist = length(dUv);
            transformed.z += uBulge * (exp(-dist * dist / 0.035) * 0.9 + sin(dist * 22.0 - uTime * 4.0) * exp(-dist * 3.0) * 0.12);`,
          );
      };
    };
    const GLOW_PAD = 3.2;
    const glowGeo = new THREE.PlaneGeometry(PANEL_W + GLOW_PAD, PANEL_H + GLOW_PAD);
    const glowTex = frameGlowTexture(PANEL_W, PANEL_H, GLOW_PAD);
    const panels: Array<Panel | null> = [null];
    projects.forEach((p, i) => {
      const poster = p.walk ? loader.load(asset(`/walk/${p.id}.jpg`)) : p.shot ? loader.load(asset(p.shot)) : titleTexture(p.title);
      poster.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: poster, transparent: true, opacity: 0, side: THREE.DoubleSide });
      addWarp(mat);
      const mesh = new THREE.Mesh(panelGeo, mat);
      mesh.position.copy(pagePos(i + 1));
      // Glowing frame: a soft halo behind the panel plus a bright edge line.
      const glowMat = new THREE.MeshBasicMaterial({
        map: glowTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.z = -0.05;
      mesh.add(glow);
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0 });
      mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
      scene.add(mesh);
      panels.push({ mesh, mat, glowMat, edgeMat, poster, walk: p.walk, src: asset(`/walk/${p.id}.mp4`), video: null, vtex: null });
    });

    // Every walkthrough is downloaded on open, one at a time in page order, and kept in memory as a blob.
    // A video then plays from the phone the moment its page opens, with no network wait (works on iOS too).
    const blobUrls = new Map<number, string>();
    let loaderStopped = false;
    const loadAllVideos = async () => {
      for (let k = 1; k < panels.length; k++) {
        const p = panels[k];
        if (loaderStopped) return;
        if (!p || !p.walk) continue;
        try {
          const res = await fetch(p.src);
          if (!res.ok) continue;
          const url = URL.createObjectURL(await res.blob());
          if (loaderStopped) {
            URL.revokeObjectURL(url);
            return;
          }
          blobUrls.set(k, url);
          // A player made before its download finished switches to the local copy while it is off screen.
          if (p.video && p.video.paused && k !== active) p.video.src = url;
        } catch {
          // Network error: this video falls back to streaming when its page opens.
        }
      }
    };
    loadAllVideos();

    const ensureVideo = (k: number): HTMLVideoElement | null => {
      const p = panels[k];
      if (!p || !p.walk) return null;
      if (!p.video) {
        const v = document.createElement('video');
        v.src = blobUrls.get(k) ?? p.src;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.preload = 'auto';
        // VideoTexture uploads on every screen frame by default. Upload only when the video time has
        // moved, so a 30 fps video is not re-uploaded on every 60 fps frame.
        const vtex = new THREE.VideoTexture(v);
        let lastT = -1;
        vtex.update = () => {
          if (v.readyState >= v.HAVE_CURRENT_DATA && v.currentTime !== lastT) {
            lastT = v.currentTime;
            vtex.needsUpdate = true;
          }
        };
        vtex.colorSpace = THREE.SRGBColorSpace;
        p.video = v;
        p.vtex = vtex;
      }
      return p.video;
    };

    /* ── morphing particle cloud ── */
    const C = PARTICLE_COUNT;
    const cur = new Float32Array(C * 3);
    const vel = new Float32Array(C * 3);
    const tgt = new Float32Array(C * 3);
    const col = new Float32Array(C * 3);
    const tcol = new Float32Array(C * 3);
    const dim = new Float32Array(C).fill(1); // per-particle brightness target
    for (let i = 0; i < C; i++) {
      cur[i * 3] = (Math.random() - 0.5) * 60;
      cur[i * 3 + 1] = (Math.random() - 0.5) * 36;
      cur[i * 3 + 2] = (Math.random() - 0.5) * 30;
      col.set([0.45, 0.9, 1], i * 3);
    }
    tgt.set(cur);
    tcol.set(col);
    const cloudGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(cur, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const colAttr = new THREE.BufferAttribute(col, 3);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    cloudGeo.setAttribute('position', posAttr);
    cloudGeo.setAttribute('color', colAttr);
    const cloudMat = new THREE.PointsMaterial({
      size: 0.17,
      map: dotTex,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const cloud = new THREE.Points(cloudGeo, cloudMat);
    cloud.frustumCulled = false;
    scene.add(cloud);

    /* ── overlay: glowing particles that drift over the active video and part around the pointer ── */
    const O = SMALL_SCREEN ? 300 : 900;
    const oPos = new Float32Array(O * 3);
    const oVel = new Float32Array(O * 3);
    const oHome = new Float32Array(O * 3);
    const oSeed = new Float32Array(O);
    const oCentre = new THREE.Vector3();
    for (let i = 0; i < O; i++) oSeed[i] = Math.random() * 100;
    const overlayGeo = new THREE.BufferGeometry();
    const oAttr = new THREE.BufferAttribute(oPos, 3);
    oAttr.setUsage(THREE.DynamicDrawUsage);
    overlayGeo.setAttribute('position', oAttr);
    const overlayMat = new THREE.PointsMaterial({
      // Normal blending in a saturated ice blue: additive white disappears over the white parts of a site.
      size: 0.14,
      map: dotTex,
      color: 0x3fbfff,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const overlay = new THREE.Points(overlayGeo, overlayMat);
    overlay.frustumCulled = false;
    overlay.renderOrder = 10; // always drawn on top of the video
    scene.add(overlay);
    const streakPos = new Float32Array(O * 6);
    const streakGeo = new THREE.BufferGeometry();
    const sAttr = new THREE.BufferAttribute(streakPos, 3);
    sAttr.setUsage(THREE.DynamicDrawUsage);
    streakGeo.setAttribute('position', sAttr);
    const streakMat = new THREE.LineBasicMaterial({
      color: 0x3fbfff,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    const streaks = new THREE.LineSegments(streakGeo, streakMat);
    streaks.frustumCulled = false;
    streaks.renderOrder = 10;
    scene.add(streaks);

    // Rain over the video, matching the background: oHome[j + 1] is the drop's fall speed, oHome[j + 2] its depth.
    const RAIN_TOP = PANEL_H / 2 + 1.5;
    const spawnDrop = (i: number, anyHeight: boolean) => {
      const j = i * 3;
      oHome[j + 1] = 0.07 + Math.random() * 0.08;
      oHome[j + 2] = 0.4 + Math.random() * 1.4;
      oPos[j] = oCentre.x + (Math.random() - 0.5) * (PANEL_W + 3);
      oPos[j + 1] = oCentre.y + (anyHeight ? (Math.random() * 2 - 1) * RAIN_TOP : RAIN_TOP + Math.random());
      oPos[j + 2] = oCentre.z + oHome[j + 2];
      oVel[j] = 0;
      oVel[j + 1] = -oHome[j + 1];
      oVel[j + 2] = 0;
    };
    const placeOverlay = (centre: THREE.Vector3) => {
      oCentre.copy(centre);
      for (let i = 0; i < O; i++) spawnDrop(i, true);
    };

    /* ── galaxy: a tilted spiral the cloud swirls into between images ── */
    const ARMS = 4;
    const gR = new Float32Array(C); // radius as a fraction of the galaxy size
    const gTheta = new Float32Array(C); // start angle on its arm
    const gZ = new Float32Array(C); // disc thickness noise
    const gCol = new Float32Array(C * 3);
    for (let i = 0; i < C; i++) {
      const r = Math.pow(Math.random(), 0.6);
      const arm = i % ARMS;
      gR[i] = r;
      gTheta[i] = (arm / ARMS) * Math.PI * 2 + r * 5.5 + (Math.random() - 0.5) * (0.5 + 0.6 * (1 - r));
      gZ[i] = (Math.random() - 0.5) * (1 - r) * 1.6;
      // Core warm white, then cyan, violet and pink toward the rim.
      const stops: Array<[number, number, number]> = [
        [1, 0.95, 0.88],
        [0.35, 0.88, 1],
        [0.55, 0.4, 1],
        [1, 0.3, 0.62],
      ];
      const f = Math.min(0.999, r) * (stops.length - 1);
      const a = stops[Math.floor(f)];
      const b = stops[Math.floor(f) + 1];
      const m = f - Math.floor(f);
      gCol[i * 3] = a[0] + (b[0] - a[0]) * m;
      gCol[i * 3 + 1] = a[1] + (b[1] - a[1]) * m;
      gCol[i * 3 + 2] = a[2] + (b[2] - a[2]) * m;
    }
    // keepOut: particles over the inside of the video move behind it, so only the border is crossed.
    const galaxy = { on: false, centre: new THREE.Vector3(), size: 10, spin: 0, keepOut: false };
    const TILT = 1.05; // radians the disc leans back from the viewer
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);

    const startGalaxy = (centre: THREE.Vector3, size: number, kick: number, keepOut = false) => {
      galaxy.on = true;
      galaxy.keepOut = keepOut;
      galaxy.centre.copy(centre);
      galaxy.size = size;
      tcol.set(gCol);
      for (let i = 0; i < C * 3; i++) vel[i] += (Math.random() - 0.5) * kick;
    };

    // Inner stars orbit faster than outer ones, so the arms wind as it spins.
    const updateGalaxyTargets = (dt: number) => {
      galaxy.spin += dt;
      const c = galaxy.centre;
      for (let i = 0; i < C; i++) {
        const r = gR[i] * galaxy.size;
        const th = gTheta[i] + galaxy.spin * (0.9 / (0.25 + gR[i]));
        const x = Math.cos(th) * r;
        const y = Math.sin(th) * r;
        const j = i * 3;
        tgt[j] = c.x + x;
        tgt[j + 1] = c.y + y * cosT + gZ[i];
        // The tilted disc passes through the panel plane: front arms cross over the video, back arms sit behind it.
        tgt[j + 2] = c.z - y * sinT + 0.6;
        // Over the video the front particles stay, but dimmed to a faint sparkle so the site stays readable.
        let d = 1;
        if (galaxy.keepOut && tgt[j + 2] > c.z - 0.2) {
          const ly = y * cosT + gZ[i];
          if (Math.abs(x) < PANEL_W / 2 && Math.abs(ly) < PANEL_H / 2) d = 0.22;
        }
        dim[i] = d;
      }
    };

    const morphTo = (shape: Shape, centre: THREE.Vector3, kick: number, scale = 1) => {
      galaxy.on = false;
      dim.fill(1);
      for (let i = 0; i < C; i++) {
        const j = i * 3;
        tgt[j] = centre.x + shape.pos[j] * SHAPE_SCALE * scale;
        tgt[j + 1] = centre.y + shape.pos[j + 1] * SHAPE_SCALE * scale;
        tgt[j + 2] = centre.z + shape.pos[j + 2] * SHAPE_SCALE * scale;
        vel[j] += (Math.random() - 0.5) * kick;
        vel[j + 1] += (Math.random() - 0.5) * kick;
        vel[j + 2] += (Math.random() - 0.5) * kick;
      }
      tcol.set(shape.col);
    };

    /* ── tweens and camera flight ── */
    let token = 0;
    let tweens: Tween[] = [];
    const animate = (dur: number, fn: (e: number) => void, my: number) => {
      tweens.push({ t0: performance.now(), dur: Math.max(1, dur), fn, token: my });
    };
    const fade = (mat: THREE.Material & { opacity: number }, to: number, dur: number, my: number) => {
      const from = mat.opacity;
      animate(dur, (e) => (mat.opacity = from + (to - from) * e), my);
    };

    const camPos = new THREE.Vector3();
    const look = new THREE.Vector3();
    let flight: { fromP: THREE.Vector3; toP: THREE.Vector3; fromL: THREE.Vector3; toL: THREE.Vector3; t0: number } | null = null;
    let active = 0;

    const fly = (k: number) => {
      if (k === active && flight === null) return;
      const prev = active;
      active = k;
      const my = ++token;
      const centre = k === 0 ? heroCentre() : pagePos(k);

      // Outgoing video keeps playing while it dissolves, then rests on its poster once invisible.
      const pp = panels[prev];
      if (pp) {
        window.setTimeout(() => {
          if (active === prev) return;
          pp.video?.pause();
          pp.mat.map = pp.poster;
          pp.mat.needsUpdate = true;
        }, 750);
      }
      // Every panel hides while flying, including the incoming one, so the particles form its image in the open.
      const np = panels[k];
      panels.forEach((p) => {
        if (!p) return;
        fade(p.mat, 0, p === np ? 200 : 250, my);
        fade(p.glowMat, 0, 300, my);
        fade(p.edgeMat, 0, 300, my);
      });
      fade(cloudMat, 1, 300, my);
      fade(overlayMat, 0, 300, my);
      fade(streakMat, 0, 300, my);

      // Scroll-out: the outgoing video tears into particles at its exact position, then they fly on to the next page.
      const torn = prev > 0 && prev <= N ? shapeResolved.get(prev) : undefined;
      if (torn) {
        const pc = pagePos(prev);
        for (let i = 0; i < C; i++) {
          const j = i * 3;
          cur[j] = pc.x + torn.pos[j] * SHAPE_SCALE;
          cur[j + 1] = pc.y + torn.pos[j + 1] * SHAPE_SCALE;
          cur[j + 2] = pc.z + torn.pos[j + 2] * SHAPE_SCALE + 0.05;
          vel[j] = 0;
          vel[j + 1] = 0;
          vel[j + 2] = 0;
        }
        col.set(torn.col);
      }

      // In flight the cloud swirls into a galaxy at the destination,
      // then the galaxy collapses into the page's image before landing.
      startGalaxy(centre, 10, 0.6);
      const shapeReady = shapeFor(k);
      window.setTimeout(() => {
        shapeReady.then((shape) => {
          if (my === token) morphTo(shape, centre, 0.4, k === 0 ? heroScale() : 1);
        });
      }, flightMs * 0.55);

      flight = { fromP: camPos.clone(), toP: camFor(k), fromL: look.clone(), toL: pagePos(k), t0: performance.now() };

      ensureVideo(k);
      ensureVideo(k + 1);

      window.setTimeout(() => {
        if (my !== token) return;
        if (np) {
          // The image bursts back into a wider galaxy. Its arms cross the frame border, never the content.
          startGalaxy(centre, 15, 0.9, true);
          fade(np.glowMat, 0.7, REVEAL_MS, my);
          fade(np.edgeMat, 0.3, REVEAL_MS, my);
          placeOverlay(centre);
          fade(overlayMat, 0.9, REVEAL_MS, my);
          // Streaks stay off: the overlay keeps the original round glowing dots.
          const v = ensureVideo(k);
          if (v && np.vtex) {
            np.mat.map = np.vtex;
            np.mat.needsUpdate = true;
            v.play().catch(() => undefined);
          }
          fade(np.mat, VIDEO_OPACITY, REVEAL_MS, my);
          fade(cloudMat, 0.6, REVEAL_MS + 300, my);
        } else if (k !== 0) {
          // Contact and booking: the word breaks into a dim galaxy behind the page content.
          startGalaxy(centre, 18, 0.9);
          fade(cloudMat, 0.12, REVEAL_MS + 300, my);
        }
      }, flightMs + HOLD_MS);
    };
    flyRef.current = fly;

    /* ── pointer parallax ── */
    let px = 0;
    let py = 0;
    let pointerOn = false;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const focusPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const onPointer = (e: PointerEvent) => {
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      pointerOn = true;
    };
    const onPointerOut = () => {
      pointerOn = false;
    };
    if (!reduced) document.documentElement.addEventListener('pointerleave', onPointerOut);
    if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });

    // Touch: browsers stop sending pointer events once a swipe becomes a scroll, so the finger is
    // followed with touch events instead. The rain, the video bulge and the tilt all follow the finger.
    let touchEndTimer = 0;
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      window.clearTimeout(touchEndTimer);
      px = t.clientX / window.innerWidth - 0.5;
      py = t.clientY / window.innerHeight - 0.5;
      pointerOn = true;
    };
    const onTouchEnd = () => {
      // Let the effect ease back to rest after the finger lifts, rather than snapping.
      window.clearTimeout(touchEndTimer);
      touchEndTimer = window.setTimeout(() => { pointerOn = false; }, 500);
    };
    if (!reduced) {
      window.addEventListener('touchstart', onTouch, { passive: true });
      window.addEventListener('touchmove', onTouch, { passive: true });
      window.addEventListener('touchend', onTouchEnd, { passive: true });
      window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    }

    const resize = () => {
      const r = host.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!flight) {
        camPos.copy(camFor(active));
        look.copy(pagePos(active));
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Opening: the cloud spells "ALAi" at the hero, then forms the portrait.
    morphTo(sampleText('ALAi', SHAPE_LAYOUT), heroCentre(), 0, heroScale());
    const introTimer = window.setTimeout(() => {
      if (active !== 0) return;
      shapeFor(0).then((shape) => {
        if (active === 0) morphTo(shape, heroCentre(), 0.6, heroScale());
      });
      // After the intro: prepare the other page images for the scroll-out effect.
      for (let k = 0; k < PAGE_COUNT; k++) shapeFor(k).catch(() => undefined);
    }, 2200);

    /* ── render loop ── */
    let raf = 0;
    let t = 0;
    const tmp = new THREE.Vector3();
    let lastNow = performance.now();
    const tick = (now: number) => {
      t += 1 / 60;
      // Rain moves by real time, so a slow frame rate does not slow the fall.
      const rdt = Math.min(4, Math.max(0.25, (now - lastNow) / 16.667));
      lastNow = now;

      tweens = tweens.filter((tw) => {
        if (tw.token !== token) return false;
        const k = Math.min(1, (now - tw.t0) / tw.dur);
        tw.fn(k * k * (3 - 2 * k));
        return k < 1;
      });

      if (flight) {
        const k = Math.min(1, (now - flight.t0) / flightMs);
        const e = easeInOutCubic(k);
        camPos.lerpVectors(flight.fromP, flight.toP, e);
        camPos.y += Math.sin(Math.PI * e) * 3; // arc up over the path
        look.lerpVectors(flight.fromL, flight.toL, e);
        if (k >= 1) flight = null;
      }

      if (galaxy.on) updateGalaxyTargets(1 / 60);
      // Pointer force: particles near the cursor are pushed away in 3D, on the plane the camera is looking at.
      if (pointerOn) {
        ray.setFromCamera(ndc.set(px * 2, -py * 2), camera);
        focusPlane.constant = -look.z;
        if (ray.ray.intersectPlane(focusPlane, hit)) {
          const R = 2.6;
          for (let i = 0; i < C; i++) {
            const j = i * 3;
            const dx = cur[j] - hit.x;
            const dy = cur[j + 1] - hit.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < R * R && d2 > 1e-4) {
              const dist = Math.sqrt(d2);
              const f = (1 - dist / R) * 0.09;
              vel[j] += (dx / dist) * f;
              vel[j + 1] += (dy / dist) * f;
              vel[j + 2] += f * 0.6;
            }
          }
        }
      }

      for (let i = 0; i < C * 3; i++) {
        vel[i] = vel[i] * 0.86 + (tgt[i] - cur[i]) * 0.016;
        cur[i] += vel[i];
        col[i] += (tcol[i] * dim[(i / 3) | 0] - col[i]) * 0.05;
      }

      // A panel that has faded out must not draw: even at opacity 0 it writes depth and hides what is behind it.
      for (const p of panels) if (p) p.mesh.visible = p.mat.opacity > 0.01;
      for (let i = 0; i < C; i++) {
        cur[i * 3] += Math.sin(t * 0.9 + i) * 0.004;
        cur[i * 3 + 1] += Math.cos(t * 0.7 + i * 0.5) * 0.004;
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      // Overlay rain: falls with a soft sway like the background, flows around the pointer, respawns at the top.
      if (overlayMat.opacity > 0.01) {
        let ohx = 0;
        let ohy = 0;
        let oHit = false;
        if (pointerOn) {
          ray.setFromCamera(ndc.set(px * 2, -py * 2), camera);
          focusPlane.constant = -(oCentre.z + 1);
          if (ray.ray.intersectPlane(focusPlane, hit)) {
            ohx = hit.x;
            ohy = hit.y;
            oHit = true;
          }
        }
        const bottom = oCentre.y - RAIN_TOP;
        for (let i = 0; i < O; i++) {
          const j = i * 3;
          const sway = Math.sin(oPos[j + 1] * 0.4 + t * 0.3 + oSeed[i]) * 0.012;
          oVel[j] += (sway - oVel[j]) * 0.08;
          oVel[j + 1] += (-oHome[j + 1] - oVel[j + 1]) * 0.08;
          if (oHit) {
            const dx = oPos[j] - ohx;
            const dy = oPos[j + 1] - ohy;
            const d2 = dx * dx + dy * dy;
            const R = 2.4;
            if (d2 < R * R && d2 > 1e-4) {
              const dist = Math.sqrt(d2);
              const fo = (1 - dist / R) * 0.05;
              oVel[j] += (dx / dist) * fo;
              oVel[j + 1] += (dy / dist) * fo * 0.4;
            }
          }
          oPos[j] += oVel[j] * rdt;
          oPos[j + 1] += oVel[j + 1] * rdt;
          if (oPos[j + 1] < bottom) spawnDrop(i, false);
          const k = i * 6;
          streakPos[k] = oPos[j];
          streakPos[k + 1] = oPos[j + 1];
          streakPos[k + 2] = oPos[j + 2];
          streakPos[k + 3] = oPos[j] - oVel[j] * 7;
          streakPos[k + 4] = oPos[j + 1] - oVel[j + 1] * 7;
          streakPos[k + 5] = oPos[j + 2];
        }
        oAttr.needsUpdate = true;
        sAttr.needsUpdate = true;
      }

      // Active video follows the pointer: tilts toward it and bulges under it.
      const ap = panels[active];
      warp.uTime.value = t;
      let bulgeTarget = 0;
      if (ap && ap.mat.opacity > 0.5 && pointerOn) {
        ray.setFromCamera(ndc.set(px * 2, -py * 2), camera);
        const hits = ray.intersectObject(ap.mesh, false);
        if (hits.length > 0 && hits[0].uv) {
          warp.uMouse.value.lerp(hits[0].uv, 0.25);
          bulgeTarget = 0.9;
        }
      }
      warp.uBulge.value += (bulgeTarget - warp.uBulge.value) * 0.08;
      for (const p of panels) {
        if (!p) continue;
        const on = p === ap && pointerOn;
        p.mesh.rotation.x += ((on ? py * 0.22 : 0) - p.mesh.rotation.x) * 0.06;
        p.mesh.rotation.y += ((on ? px * 0.32 : 0) - p.mesh.rotation.y) * 0.06;
      }

      tmp.set(camPos.x + px * 1.6, camPos.y - py * 1.0, camPos.z);
      camera.position.copy(tmp);
      camera.lookAt(look);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(introTimer);
      loaderStopped = true;
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.clearTimeout(touchEndTimer);
      document.documentElement.removeEventListener('pointerleave', onPointerOut);
      ro.disconnect();
      flyRef.current = null;
      panels.forEach((p) => {
        if (!p) return;
        p.video?.pause();
        p.vtex?.dispose();
        p.poster.dispose();
        p.mat.dispose();
        p.glowMat.dispose();
        p.edgeMat.dispose();
      });
      panelGeo.dispose();
      edgeGeo.dispose();
      glowGeo.dispose();
      glowTex.dispose();
      dotTex.dispose();
      starGeo.dispose();
      starMat.dispose();
      overlayGeo.dispose();
      overlayMat.dispose();
      streakGeo.dispose();
      streakMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
});

export default FlyScene;
