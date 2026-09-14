'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  Crosshair,
  Maximize2,
  Satellite,
  Radio,
  Globe,
} from 'lucide-react';
import { PipelineRunResponse } from '@/lib/services/pipelineApi';

interface Moon3DViewerProps {
  observations: PipelineRunResponse[];
  selectedRun: PipelineRunResponse | null;
  onSelectRun: (run: PipelineRunResponse) => void;
  onInspect2D?: (run: PipelineRunResponse) => void;
}

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  let normLon = ((lon + 180) % 360) - 180;
  if (normLon < -180) normLon += 360;
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (normLon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/** Build a rich procedural lunar surface texture on a canvas */
function buildLunarSurfaceTexture(size = 2048): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // --- Base lunar regolith gradient (darker maria at equator, lighter highlands) ---
  const base = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.7);
  base.addColorStop(0.0,  '#5a5a60');
  base.addColorStop(0.25, '#484850');
  base.addColorStop(0.5,  '#3a3840');
  base.addColorStop(0.75, '#2e2c34');
  base.addColorStop(1.0,  '#1a1820');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // --- Mare (dark basalt plains) blobs ---
  const mare: [number, number, number, string][] = [
    [0.38, 0.30, 0.22, 'rgba(28,27,34,0.7)'],
    [0.65, 0.55, 0.18, 'rgba(24,23,30,0.65)'],
    [0.20, 0.68, 0.16, 'rgba(30,28,35,0.6)'],
    [0.50, 0.72, 0.20, 'rgba(22,21,28,0.55)'],
    [0.72, 0.25, 0.13, 'rgba(26,25,32,0.5)'],
  ];
  for (const [cx, cy, r, col] of mare) {
    const g = ctx.createRadialGradient(cx * size, cy * size, 0, cx * size, cy * size, r * size);
    g.addColorStop(0.0, col);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  // --- Highland bright patches ---
  const highlands: [number, number, number][] = [
    [0.80, 0.20, 0.09], [0.15, 0.40, 0.07],
    [0.60, 0.82, 0.08], [0.30, 0.15, 0.06],
  ];
  for (const [cx, cy, r] of highlands) {
    const g = ctx.createRadialGradient(cx * size, cy * size, 0, cx * size, cy * size, r * size);
    g.addColorStop(0, 'rgba(140,135,145,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  // --- Procedural craters: big, medium, small ---
  const rng = (min: number, max: number) => Math.random() * (max - min) + min;
  const drawCrater = (x: number, y: number, r: number, rimBright: number) => {
    // Floor (slightly darker)
    const floor = ctx.createRadialGradient(x, y, 0, x, y, r * 0.85);
    floor.addColorStop(0,   `rgba(18,17,24,0.55)`);
    floor.addColorStop(0.8, `rgba(0,0,0,0)`);
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, size, size);
    // Rim (brighter ring)
    const rim = ctx.createRadialGradient(x, y, r * 0.78, x, y, r * 1.05);
    rim.addColorStop(0, `rgba(0,0,0,0)`);
    rim.addColorStop(0.5, `rgba(${rimBright},${rimBright - 8},${rimBright + 5},0.55)`);
    rim.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, size, size);
  };

  // Large craters
  for (let i = 0; i < 14; i++) drawCrater(rng(0, size), rng(0, size), rng(60, 140), 110);
  // Medium
  for (let i = 0; i < 40; i++) drawCrater(rng(0, size), rng(0, size), rng(18, 55),  90);
  // Small pits
  for (let i = 0; i < 120; i++) drawCrater(rng(0, size), rng(0, size), rng(4, 16),  75);

  // --- Noise grain layer ---
  const imgData = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 18;
    imgData.data[i]     = Math.max(0, Math.min(255, imgData.data[i]     + noise));
    imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + noise * 0.95));
    imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + noise * 1.05));
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Pulsing glow sprite at a lat/lon */
function makeGlowSprite(color: number, scale: number): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  const r = (color >> 16) & 0xff;
  const gr = (color >> 8) & 0xff;
  const b = color & 0xff;
  g.addColorStop(0,   `rgba(${r},${gr},${b},1.0)`);
  g.addColorStop(0.3, `rgba(${r},${gr},${b},0.6)`);
  g.addColorStop(0.7, `rgba(${r},${gr},${b},0.15)`);
  g.addColorStop(1,   `rgba(${r},${gr},${b},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

function getStatusColor(status: string): number {
  if (status === 'MATCHED')   return 0x10b981;
  if (status === 'UNCERTAIN') return 0xf59e0b;
  return 0xf43f5e;
}

export default function Moon3DViewer({ observations, selectedRun, onSelectRun, onInspect2D }: Moon3DViewerProps) {
  const mountRef      = useRef<HTMLDivElement | null>(null);
  const sceneRef      = useRef<THREE.Scene | null>(null);
  const rendererRef   = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef     = useRef<THREE.PerspectiveCamera | null>(null);
  const moonGroupRef  = useRef<THREE.Group | null>(null);
  const patchesGroupRef = useRef<THREE.Group | null>(null);
  const targetRotRef  = useRef<{ x: number; y: number } | null>(null);
  const clockRef      = useRef(new THREE.Clock());

  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [zoomDistance, setZoomDistance]     = useState(3.6);
  const [coords, setCoords]                 = useState({ lat: -89.5, lon: -15.9 });
  const [fps, setFps]                       = useState(60);

  const focusObservation = useCallback((run: PipelineRunResponse) => {
    const bounds = run.geometryResult?.overlap_bounds || run.geometryResult?.image_a_bounds;
    if (!bounds || bounds.min_lat === undefined) return;
    const cLat = (bounds.min_lat + bounds.max_lat) / 2;
    const cLon = (bounds.min_lon + bounds.max_lon) / 2;
    const tx = cLat < -70 ? Math.PI * 0.46 : cLat * (Math.PI / 180);
    const ty = -(cLon * (Math.PI / 180)) - Math.PI / 2;
    targetRotRef.current = { x: tx, y: ty };
    setIsAutoRotating(false);
    setCoords({ lat: +cLat.toFixed(3), lon: +cLon.toFixed(3) });
  }, []);

  useEffect(() => {
    if (selectedRun) {
      const timer = setTimeout(() => focusObservation(selectedRun), 0);
      return () => clearTimeout(timer);
    }
  }, [selectedRun, focusObservation]);

  /* ─── Main Three.js setup ─── */
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const W = container.clientWidth;
    const H = container.clientHeight || 560;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000208, 0.018);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 500);
    camera.position.set(0, 0, 3.6);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    /* ── STARFIELD (3-layer depth) ── */
    const addStars = (count: number, spread: number, size: number, opacity: number, col: number) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count * 3; i += 3) {
        const u = Math.random(), v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi   = Math.acos(2 * v - 1);
        const r = spread * (0.7 + Math.random() * 0.3);
        pos[i]     = r * Math.sin(phi) * Math.cos(theta);
        pos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i + 2] = r * Math.cos(phi);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: col, size, transparent: true, opacity, sizeAttenuation: true, depthWrite: false });
      scene.add(new THREE.Points(geo, mat));
    };
    addStars(3200, 180, 0.28, 0.9,  0xffffff);
    addStars(800,  160, 0.18, 0.7,  0xaad4ff);
    addStars(400,  150, 0.35, 0.55, 0xffeecc);

    /* ── MOON GROUP ── */
    const moonGroup = new THREE.Group();
    moonGroup.rotation.x = Math.PI * 0.42;
    scene.add(moonGroup);
    moonGroupRef.current = moonGroup;

    const MOON_R = 1.6;

    // Surface mesh with procedural texture
    const lunarTex = buildLunarSurfaceTexture(2048);
    const moonGeo  = new THREE.SphereGeometry(MOON_R, 96, 96);
    const moonMat  = new THREE.MeshStandardMaterial({
      map:        lunarTex,
      roughness:  0.94,
      metalness:  0.04,
      bumpMap:    lunarTex,
      bumpScale:  0.018,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.castShadow    = true;
    moonMesh.receiveShadow = true;
    moonGroup.add(moonMesh);

    // Thin atmosphere rim glow (additive shell slightly larger)
    const atmGeo = new THREE.SphereGeometry(MOON_R * 1.018, 64, 64);
    const atmMat = new THREE.MeshStandardMaterial({
      color:       0x1a6080,
      emissive:    0x0a3050,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity:     0.055,
      side:        THREE.BackSide,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    moonGroup.add(new THREE.Mesh(atmGeo, atmMat));

    /* ── GRATICULE GRID ── */
    const gridMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.10, depthWrite: false });
    const gridGroup = new THREE.Group();

    for (const lat of [-85, -75, -60, -45, -30, 0, 30, 45, 60, 75, 85]) {
      const phi  = (90 - lat) * (Math.PI / 180);
      const rRing = MOON_R * Math.sin(phi);
      const yRing = MOON_R * Math.cos(phi);
      const pts: THREE.Vector3[] = [];
      for (let t = 0; t <= Math.PI * 2; t += 0.035)
        pts.push(new THREE.Vector3(rRing * Math.cos(t), yRing, rRing * Math.sin(t)));
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const theta = (lon + 180) * (Math.PI / 180);
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 2) {
        const phi = (90 - lat) * (Math.PI / 180);
        pts.push(new THREE.Vector3(
          -MOON_R * Math.sin(phi) * Math.cos(theta),
           MOON_R * Math.cos(phi),
           MOON_R * Math.sin(phi) * Math.sin(theta)
        ));
      }
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }

    // Highlight the South Pole latitude ring (-89.5°) in brighter cyan
    const spRing: THREE.Vector3[] = [];
    const spPhi = (90 - (-89.5)) * (Math.PI / 180);
    const spR   = MOON_R * Math.sin(spPhi);
    const spY   = MOON_R * Math.cos(spPhi);
    for (let t = 0; t <= Math.PI * 2; t += 0.02)
      spRing.push(new THREE.Vector3(spR * Math.cos(t), spY, spR * Math.sin(t)));
    gridGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(spRing),
      new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.45 })
    ));

    moonGroup.add(gridGroup);

    /* ── PATCHES GROUP ── */
    const patchesGroup = new THREE.Group();
    moonGroup.add(patchesGroup);
    patchesGroupRef.current = patchesGroup;

    /* ── LIGHTING ── */
    // Main sun (grazing angle for polar, dramatic shadows)
    const sun = new THREE.DirectionalLight(0xfff8e7, 3.2);
    sun.position.set(8, 2.5, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far  = 30;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -3;
    sun.shadow.camera.right = sun.shadow.camera.top   =  3;
    scene.add(sun);

    // Dim earthshine fill from opposite side
    const earthshine = new THREE.DirectionalLight(0x2040a0, 0.18);
    earthshine.position.set(-6, -2, -3);
    scene.add(earthshine);

    // Ambient — raise slightly so dark-side swath patches are readable
    scene.add(new THREE.AmbientLight(0x0f1a2e, 0.45));

    /* ── ORBIT ARC (spacecraft trajectory) — in scene root, not moonGroup ── */
    // A near-polar orbit inclined 96° from equator (Chandrayaan-2 actual inclination)
    // Orbit stays fixed in space; the moon rotates under it when you drag.
    const orbitPts: THREE.Vector3[] = [];
    const ORBIT_R   = MOON_R + 0.38;
    const INC_RAD   = (96.0 - 90.0) * (Math.PI / 180);  // inclination from equator
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.02) {
      // Rotate a circle in the XY plane by the inclination angle around X-axis
      const xo = ORBIT_R * Math.cos(a);
      const yo = ORBIT_R * Math.sin(a) * Math.cos(INC_RAD);
      const zo = ORBIT_R * Math.sin(a) * Math.sin(INC_RAD);
      orbitPts.push(new THREE.Vector3(xo, yo, zo));
    }
    const orbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPts),
      new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.22, depthWrite: false })
    );
    scene.add(orbitLine);

    // Chandrayaan-2 spacecraft dot — also in scene so it orbits independently
    const scGeo      = new THREE.SphereGeometry(0.018, 10, 10);
    const scMat      = new THREE.MeshBasicMaterial({ color: 0x93c5fd });
    const spacecraft = new THREE.Mesh(scGeo, scMat);
    scene.add(spacecraft);
    const scGlow = makeGlowSprite(0x93c5fd, 0.06);  // was 0.18 — much smaller
    spacecraft.add(scGlow);

    /* ── MOUSE / WHEEL ── */
    let dragging = false;
    let prevMouse = { x: 0, y: 0 };

    const onDown = (e: MouseEvent) => {
      dragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
      setIsAutoRotating(false);
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging || !moonGroupRef.current) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      moonGroupRef.current.rotation.y += dx * 0.004;
      moonGroupRef.current.rotation.x += dy * 0.004;
      moonGroupRef.current.rotation.x = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, moonGroupRef.current.rotation.x));
      prevMouse = { x: e.clientX, y: e.clientY };
      const cLon = -moonGroupRef.current.rotation.y * (180 / Math.PI);
      const cLat =  moonGroupRef.current.rotation.x * (180 / Math.PI);
      setCoords({ lat: +cLat.toFixed(2), lon: +((cLon % 360 + 540) % 360 - 180).toFixed(2) });
    };
    const onUp = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      cameraRef.current.position.z += e.deltaY * 0.002;
      cameraRef.current.position.z = Math.max(1.85, Math.min(7.0, cameraRef.current.position.z));
      setZoomDistance(+cameraRef.current.position.z.toFixed(2));
    };
    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    /* ── ANIMATION LOOP ── */
    let animId: number;
    let frameCount = 0;
    let fpsTimer = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = clockRef.current.getDelta();
      const elapsed = clockRef.current.elapsedTime;

      fpsTimer += dt; frameCount++;
      if (fpsTimer >= 1) { setFps(Math.round(frameCount / fpsTimer)); frameCount = 0; fpsTimer = 0; }

      if (moonGroupRef.current) {
        if (targetRotRef.current) {
          const t = targetRotRef.current;
          moonGroupRef.current.rotation.x += (t.x - moonGroupRef.current.rotation.x) * 0.07;
          moonGroupRef.current.rotation.y += (t.y - moonGroupRef.current.rotation.y) * 0.07;
          if (Math.abs(t.x - moonGroupRef.current.rotation.x) < 0.001 &&
              Math.abs(t.y - moonGroupRef.current.rotation.y) < 0.001)
            targetRotRef.current = null;
        } else if (isAutoRotating) {
          moonGroupRef.current.rotation.y += 0.001;
        }
      }

      // Spacecraft orbit animation
      const orbitAngle = elapsed * 0.28;
      spacecraft.position.set(
        ORBIT_R * Math.cos(orbitAngle),
        ORBIT_R * Math.sin(orbitAngle) * Math.sin(0.18),
        ORBIT_R * Math.sin(orbitAngle) * Math.cos(0.18)
      );

      // Pulse swath glow borders
      const pulse = 0.55 + 0.45 * Math.sin(elapsed * 2.8);
      patchesGroupRef.current?.children.forEach((child) => {
        if (child instanceof THREE.Line) {
          (child.material as THREE.LineBasicMaterial).opacity = 0.55 + 0.4 * pulse;
        }
        if (child instanceof THREE.Sprite) {
          (child.material as THREE.SpriteMaterial).opacity = 0.5 + 0.5 * pulse;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container || !renderer || !camera) return;
      const nW = container.clientWidth;
      const nH = container.clientHeight || 560;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, [isAutoRotating]);

  /* ─── Build observation swath patches ─── */
  useEffect(() => {
    const pg = patchesGroupRef.current;
    if (!pg) return;
    pg.clear();

    const MOON_R = 1.603;
    const N = 20;

    observations.forEach((run) => {
      const isSelected = selectedRun?.runId === run.runId;
      const status = run.validationResult?.status ||
        (run.status === 'COMPLETED' ? 'MATCHED' : run.status === 'FAILED' ? 'UNMATCHED' : 'UNCERTAIN');
      const col = getStatusColor(status);

      const geo_result = run.geometryResult;

      // ── Resolve 4 corner coordinates (lat, lon) for this run's swath ──
      // Priority 1: PDS4 XML precise 4-corner footprint (image_b_corners from metadata_parser)
      // Priority 2: Axis-aligned bounding box from image_b_bounds
      // Priority 3: Hardcoded South Pole fallback (for demo runs without metadata)
      let ul_lat: number, ul_lon: number;
      let ur_lat: number, ur_lon: number;
      let ll_lat: number, ll_lon: number;
      let lr_lat: number, lr_lon: number;

      const corners = geo_result?.image_b_corners;
      const bounds  = geo_result?.image_b_bounds;

      if (corners?.upper_left && corners?.upper_right && corners?.lower_left && corners?.lower_right) {
        // ✅ Exact PDS4 corners — most accurate
        [ul_lat, ul_lon] = corners.upper_left;
        [ur_lat, ur_lon] = corners.upper_right;
        [ll_lat, ll_lon] = corners.lower_left;
        [lr_lat, lr_lon] = corners.lower_right;
      } else if (bounds) {
        // ↩ Axis-aligned BBOX fallback
        ul_lat = bounds.max_lat; ul_lon = bounds.min_lon;
        ur_lat = bounds.max_lat; ur_lon = bounds.max_lon;
        ll_lat = bounds.min_lat; ll_lon = bounds.min_lon;
        lr_lat = bounds.min_lat; lr_lon = bounds.max_lon;
      } else {
        // 🔁 Demo fallback: real Chandrayaan-2 South Pole swath PDS4 corners
        ul_lat = -89.19986;  ul_lon = -137.740672;
        ur_lat = -89.20906;  ur_lon = -130.271027;
        ll_lat = -89.908842; ll_lon =  110.268353;
        lr_lat = -89.946885; lr_lon =   22.453651;
      }

      const positions: number[] = [], uvs: number[] = [], indices: number[] = [];

      for (let i = 0; i <= N; i++) {
        const v = i / N;
        const lLat = ul_lat + v * (ll_lat - ul_lat);
        const lLon = ul_lon + v * (ll_lon - ul_lon);
        const rLat = ur_lat + v * (lr_lat - ur_lat);
        const rLon = ur_lon + v * (lr_lon - ur_lon);
        for (let j = 0; j <= N; j++) {
          const u = j / N;
          const pt = latLonToVector3(lLat + u * (rLat - lLat), lLon + u * (rLon - lLon), MOON_R);
          positions.push(pt.x, pt.y, pt.z);
          uvs.push(u, 1 - v);
        }
      }
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const r1 = i * (N + 1), r2 = (i + 1) * (N + 1);
          indices.push(r1 + j, r2 + j, r1 + j + 1, r1 + j + 1, r2 + j, r2 + j + 1);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      // Texture: real uploaded image from API, draped over the swath footprint
      const rawBase = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000/api').replace(/\/+$/, '')
        : 'http://localhost:8000/api';
      const apiBase = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;
      const texLoader = new THREE.TextureLoader();
      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.85,
        metalness: 0.02,
        side:      THREE.DoubleSide,
        // Show a faint status-colour tint while the texture loads
        color:          new THREE.Color(0x888888),
        emissive:       new THREE.Color(col).multiplyScalar(isSelected ? 0.12 : 0.04),
        emissiveIntensity: 1.0,
      });
      // Load real image — set needsUpdate so Three.js re-renders after async load
      texLoader.load(
        `${apiBase}/pipeline/run/${run.runId}/image-b`,
        (loadedTex) => {
          loadedTex.colorSpace  = THREE.SRGBColorSpace;
          loadedTex.wrapS       = THREE.ClampToEdgeWrapping;
          loadedTex.wrapT       = THREE.ClampToEdgeWrapping;
          loadedTex.needsUpdate = true;
          mat.map              = loadedTex;
          mat.color.set(0xffffff);   // let texture show full colour
          mat.needsUpdate          = true;
        },
        undefined,
        () => { /* silently keep the fallback tint on error */ }
      );
      pg.add(new THREE.Mesh(geo, mat));

      // Glowing border
      const buildEdge = (pts: THREE.Vector3[]) =>
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({
            color: col,
            transparent: true,
            opacity: isSelected ? 0.95 : 0.65,
            linewidth: 1,
          })
        );

      const top: THREE.Vector3[]    = [], bottom: THREE.Vector3[] = [];
      const left: THREE.Vector3[]   = [], right: THREE.Vector3[]  = [];
      for (let k = 0; k <= N; k++) {
        const u = k / N;
        top.push(latLonToVector3(   ul_lat + u * (ur_lat - ul_lat), ul_lon + u * (ur_lon - ul_lon), MOON_R + 0.005));
        bottom.push(latLonToVector3(ll_lat + u * (lr_lat - ll_lat), ll_lon + u * (lr_lon - ll_lon), MOON_R + 0.005));
        const v = k / N;
        left.push(latLonToVector3( ul_lat + v * (ll_lat - ul_lat), ul_lon + v * (ll_lon - ul_lon), MOON_R + 0.005));
        right.push(latLonToVector3(ur_lat + v * (lr_lat - ur_lat), ur_lon + v * (lr_lon - ur_lon), MOON_R + 0.005));
      }
      [top, bottom, left, right].forEach(pts => pg.add(buildEdge(pts)));

      // Glow sprite at center (tiny — just a subtle location indicator)
      const cLat = (ul_lat + ur_lat + ll_lat + lr_lat) / 4;
      const cLon = (ul_lon + ur_lon + ll_lon + lr_lon) / 4;
      const cPos = latLonToVector3(cLat, cLon, MOON_R + 0.015);
      const glow = makeGlowSprite(col, isSelected ? 0.10 : 0.065);
      glow.position.copy(cPos);
      pg.add(glow);

      // Pin stalk
      const stalkH = isSelected ? 0.18 : 0.10;
      const stalkPts = [
        latLonToVector3(cLat, cLon, MOON_R),
        latLonToVector3(cLat, cLon, MOON_R + stalkH),
      ];
      pg.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(stalkPts),
        new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: isSelected ? 1.0 : 0.6 })
      ));

      // Pin head (small sphere)
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(isSelected ? 0.022 : 0.012, 12, 12),
        new THREE.MeshBasicMaterial({ color: col })
      );
      pin.position.copy(latLonToVector3(cLat, cLon, MOON_R + stalkH));
      pg.add(pin);

      if (isSelected) {
        // Selected: add a halo ring (flat torus) around the pin, not a giant sprite
        const haloGeo = new THREE.TorusGeometry(0.06, 0.006, 6, 32);
        const haloMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.copy(pin.position);
        // Orient the halo ring to face outward from the sphere surface
        halo.lookAt(0, 0, 0);
        halo.rotateX(Math.PI / 2);
        pg.add(halo);
      }
    });
  }, [observations, selectedRun]);

  const altKm = ((zoomDistance - 1.6) * 1000).toFixed(0);

  return (
    <div className="relative w-full h-[560px] sm:h-[600px] rounded-2xl overflow-hidden bg-[#00010a] border border-cyan-900/40 shadow-[0_0_80px_rgba(0,0,0,0.98),0_0_30px_rgba(6,182,212,0.04)] select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* ── TOP HUD ── */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        {/* Title badge */}
        <div className="flex items-center gap-2.5 bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl border border-cyan-900/50 text-xs font-mono shadow-2xl pointer-events-auto">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-slate-200 tracking-wide">3D SELENOGRAPHIC GLOBE</span>
          <span className="text-[10px] text-cyan-400 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-800/40 tracking-wider">
            CHANDRAYAAN-2
          </span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              isAutoRotating
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-[0_0_14px_rgba(6,182,212,0.25)]'
                : 'bg-black/70 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isAutoRotating ? 'animate-spin' : ''}`} />
            <span>{isAutoRotating ? 'Orbiting' : 'Paused'}</span>
          </button>

          {selectedRun && (
            <>
              <button
                onClick={() => focusObservation(selectedRun)}
                className="px-3 py-1.5 rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-700/40 text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-cyan-900/60 shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-all cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>South Pole</span>
              </button>

              {onInspect2D && (
                <button
                  onClick={() => onInspect2D(selectedRun)}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_22px_rgba(16,185,129,0.45)] transition-all cursor-pointer border border-emerald-600/40"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Inspect 2D Surface</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── SPACECRAFT TELEMETRY (top-right corner) ── */}
      <div className="absolute top-16 right-3 bg-black/75 backdrop-blur-md px-3 py-2 rounded-xl border border-blue-900/40 text-[10px] font-mono text-slate-400 space-y-1 z-10 pointer-events-none">
        <div className="flex items-center gap-1.5 text-blue-400 font-bold">
          <Satellite className="w-3 h-3" />
          <span>CH-2 / ORBITER</span>
        </div>
        <div>Alt: <span className="text-slate-200">{altKm} km</span></div>
        <div>Inc: <span className="text-slate-200">96.0°</span></div>
        <div className="flex items-center gap-1 text-emerald-400">
          <Radio className="w-2.5 h-2.5" />
          <span>NOMINAL</span>
        </div>
        <div className="text-[9px] text-slate-600 border-t border-slate-800 pt-1 mt-0.5">
          {fps} fps · {observations.length} obs loaded
        </div>
      </div>

      {/* ── BOTTOM HUD ── */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pointer-events-none z-10">
        {/* Coordinates */}
        <div className="bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800/60 text-[11px] font-mono text-slate-400 flex items-center gap-3 shadow-xl pointer-events-auto">
          <div>
            Lat: <span className="text-cyan-300 font-bold">
              {coords.lat < -88 ? '-89.57°S (South Pole)' : `${coords.lat}°`}
            </span>
          </div>
          <div className="text-slate-700">·</div>
          <div>
            Lon: <span className="text-slate-200 font-bold">{coords.lon}°E</span>
          </div>
          <div className="text-slate-700">·</div>
          <div>
            Alt: <span className="text-slate-200 font-bold">{altKm} km</span>
          </div>
          {selectedRun && (
            <>
              <div className="text-slate-700">·</div>
              <div>
                RMSE: <span className="text-emerald-400 font-bold">
                  {selectedRun.validationResult?.confidence?.total_rmse_px?.toFixed(2) ?? '—'} px
                </span>
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800/60 text-[10px] font-mono flex items-center gap-4 shadow-xl pointer-events-auto">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" /> MATCHED
          </span>
          <span className="flex items-center gap-1.5 text-amber-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" /> UNCERTAIN
          </span>
          <span className="flex items-center gap-1.5 text-rose-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#f43f5e]" /> UNMATCHED
          </span>
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> CH-2 Orbit
          </span>
        </div>
      </div>

      {/* ── DRAG HINT (fades after first drag) ── */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-[10px] font-mono text-slate-600 pointer-events-none select-none">
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
}
