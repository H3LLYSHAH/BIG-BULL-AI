import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * CandleLoader3D
 * --------------
 * A 3D, WebGL version of the candlestick "buffering" indicator — same idea
 * as CandleLoader.jsx, but the bars are real geometry that breathes/rotates
 * in 3D space on a solid black background, instead of flat CSS bars.
 *
 * npm install three   ← required
 *
 * Usage:
 *   <CandleLoader3D label="Saving to your account…" />
 *   <CandleLoader3D label="Connection lost — retrying…" tone="down" />
 *   <CandleLoader3D label="Fetching live prices…" tone="mixed" size={220} />
 *
 * Props:
 *   label - optional text under the canvas
 *   tone  - 'mixed' (alternating red/green), 'up' (all green), 'down' (all red)
 *   size  - canvas width/height in px (default 200)
 */
export default function CandleLoader3D({ label = 'Loading…', tone = 'mixed', size = 200 }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const GREEN = 0x2fae66;
    const RED = 0xd64545;
    const GRAY = 0x6b7280;

    const colorFor = (i) => {
      if (tone === 'up') return GREEN;
      if (tone === 'down') return RED;
      return i % 2 === 0 ? GRAY : RED;
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 1.2, 9);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // Bar definitions: base height, wick lengths, horizontal offset —
    // staggered/descending like the reference screenshot.
    const bars = [
      { baseH: 1.4, wickTop: 0.5, wickBottom: 0.3, x: -3 },
      { baseH: 2.2, wickTop: 0.6, wickBottom: 0.4, x: -1.5 },
      { baseH: 1.8, wickTop: 0.35, wickBottom: 0.9, x: 0 },
      { baseH: 1.5, wickTop: 0.45, wickBottom: 0.6, x: 1.5 },
      { baseH: 1.2, wickTop: 0.3, wickBottom: 0.4, x: 3 },
    ];

    const candleMeshes = bars.map((bar, i) => {
      const color = colorFor(i);
      const barGroup = new THREE.Group();
      barGroup.position.x = bar.x;

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, bar.baseH, 0.4),
        new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.5 })
      );
      body.position.y = bar.baseH / 2;
      barGroup.add(body);

      const wickMat = new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.6 });
      const wickTop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, bar.wickTop, 8), wickMat);
      wickTop.position.y = bar.baseH + bar.wickTop / 2;
      barGroup.add(wickTop);

      const wickBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, bar.wickBottom, 8), wickMat.clone());
      wickBottom.position.y = -bar.wickBottom / 2;
      barGroup.add(wickBottom);

      group.add(barGroup);
      return { barGroup, body, baseH: bar.baseH, phase: i * 0.6 };
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 6, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fb3ff, 0.35);
    fill.position.set(-4, -2, 3);
    scene.add(fill);

    let frameId;
    let t = 0;
    const animate = () => {
      t += 0.02;
      group.rotation.y = Math.sin(t * 0.4) * 0.35;
      candleMeshes.forEach(({ barGroup, phase }) => {
        const breathe = 0.75 + 0.25 * Math.sin(t * 2.4 + phase);
        barGroup.scale.y = breathe;
      });
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      candleMeshes.forEach(({ body }) => {
        body.geometry.dispose();
        body.material.dispose();
      });
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        }
      });
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [tone, size]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        background: '#000000',
        padding: '20px 26px',
        borderRadius: 10,
        width: 'fit-content',
      }}
      role="status"
      aria-live="polite"
    >
      <div ref={mountRef} style={{ width: size, height: size }} />
      {label && (
        <div
          style={{
            fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
            fontSize: 12,
            color: '#9aa3b2',
            letterSpacing: 0.3,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
