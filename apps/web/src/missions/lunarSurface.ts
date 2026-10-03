import * as THREE from 'three';
import type { WorldStyle } from '@ztype/core';

/** Small, repeatable regolith maps; no downloaded textures or per-frame uploads. */
export function createRegolith(style: WorldStyle = 'craters') {
  const icy = ['ice', 'plumes', 'frost', 'glacier'].includes(style);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(512, 512);
  let seed = 912;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const grain =
        (icy ? 172 : 107) +
        random() * (icy ? 18 : 38) +
        (['dunes', 'haze'].includes(style)
          ? Math.sin(x * 0.08 + Math.sin(y * 0.024) * 4) * 24
          : Math.sin(x * 0.061) * Math.sin(y * 0.047) * 12);
      pixels.data[i] = grain;
      pixels.data[i + 1] = grain * 0.98;
      pixels.data[i + 2] = grain * 0.93;
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  for (let i = 0; i < (['craters', 'mining'].includes(style) ? 32 : 0); i++) {
    const x = random() * 512,
      y = random() * 512,
      radius = 2 + random() * 14;
    const gradient = ctx.createRadialGradient(x - radius * 0.12, y, 0, x, y, radius);
    gradient.addColorStop(0, '#14182140');
    gradient.addColorStop(0.62, '#242c3430');
    gradient.addColorStop(0.8, '#d6d1be38');
    gradient.addColorStop(1, '#d6d1be00');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  if (icy || style === 'ridges' || style === 'canyon') {
    ctx.strokeStyle = icy ? '#3c60765c' : '#34314255';
    ctx.lineWidth = icy ? 1.8 : 3;
    for (let i = 0; i < 13; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 43, 0);
      for (let y = 0; y < 540; y += 30) ctx.lineTo(i * 43 + Math.sin(y * 0.018 + i) * 22, y);
      ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(18, 18);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const bump = map.clone();
  bump.colorSpace = THREE.NoColorSpace;
  return {
    map,
    bump,
    dispose: () => {
      map.dispose();
      bump.dispose();
    },
  };
}
