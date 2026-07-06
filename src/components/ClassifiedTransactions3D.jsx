import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { classifyTransactions, TX_TYPES } from '../lib/txClassifier';

const TYPE_COLOR = {
  trade: 0x8fb3ff,
  swap: 0xc9932f,
  fee: 0xd64545,
  staking_reward: 0x2fae66,
  transfer: 0x9aa3b2,
};

const TYPE_LABEL = {
  trade: 'Trade',
  swap: 'Swap',
  fee: 'Fee',
  staking_reward: 'Staking reward',
  transfer: 'Transfer',
};

/**
 * ClassifiedTransactions3D
 * ------------------------
 * Runs each transaction through the TensorFlow.js classifier (advisory only
 * — never touches the FIFO tax numbers) and renders the guesses as floating,
 * gently rotating 3D tokens on a solid black background, color-coded by
 * guessed type, sized by confidence.
 *
 * Usage: <ClassifiedTransactions3D transactions={rows} />
 * where rows are the same objects used for the tax calc — needs
 * { quantity, price, fee?, asset, type }.
 */
export default function ClassifiedTransactions3D({ transactions = [], size = 320 }) {
  const mountRef = useRef(null);
  const [classified, setClassified] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    classifyTransactions(transactions)
      .then((rows) => {
        if (!cancelled) {
          setClassified(rows);
          setStatus('ready');
        }
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [transactions]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || status !== 'ready' || !classified) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 2, 11);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 6, 6);
    scene.add(key);

    const group = new THREE.Group();
    scene.add(group);

    const n = Math.min(classified.length, 24); // cap for perf/readability
    const radius = 3.6;
    const meshes = [];

    for (let i = 0; i < n; i++) {
      const row = classified[i];
      const color = TYPE_COLOR[row.predictedType] ?? 0x9aa3b2;
      const conf = row.confidence ?? 0.5;
      const scale = 0.35 + conf * 0.45;

      const geo = new THREE.IcosahedronGeometry(scale, 0);
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4 });
      const mesh = new THREE.Mesh(geo, mat);

      const angle = (i / n) * Math.PI * 2;
      const ringRadius = radius * (0.6 + 0.4 * (i % 3) / 2);
      mesh.position.set(Math.cos(angle) * ringRadius, Math.sin(angle * 1.3) * 1.2, Math.sin(angle) * ringRadius);

      group.add(mesh);
      meshes.push({ mesh, phase: i * 0.4, baseY: mesh.position.y });
    }

    let frameId;
    let t = 0;
    const animate = () => {
      t += 0.01;
      group.rotation.y += 0.003;
      meshes.forEach(({ mesh, phase, baseY }) => {
        mesh.rotation.x += 0.01;
        mesh.rotation.y += 0.008;
        mesh.position.y = baseY + Math.sin(t * 1.5 + phase) * 0.25;
      });
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry.dispose();
          obj.material.dispose();
        }
      });
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [classified, status, size]);

  const counts = classified
    ? TX_TYPES.map((t) => ({ type: t, count: classified.filter((r) => r.predictedType === t).length }))
    : [];

  return (
    <div style={{ background: '#000000', borderRadius: 10, padding: 18, width: 'fit-content' }}>
      <style>{`
        .cx3d-legend { display:flex; flex-wrap:wrap; gap:10px; margin-top:12px; font-family: ui-monospace, 'IBM Plex Mono', monospace; font-size:11.5px; }
        .cx3d-legend span.dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; }
        .cx3d-note { font-family: ui-monospace, 'IBM Plex Mono', monospace; font-size:10.5px; color:#6b7280; margin-top:8px; max-width: ${size}px; }
      `}</style>

      {status === 'loading' && (
        <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa3b2', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
          Training classifier…
        </div>
      )}
      {status === 'error' && (
        <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d64545', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
          Couldn't run the classifier.
        </div>
      )}
      {status === 'ready' && <div ref={mountRef} style={{ width: size, height: size }} />}

      {status === 'ready' && (
        <>
          <div className="cx3d-legend">
            {counts.map(({ type, count }) => (
              <span key={type} style={{ color: '#c8cdd6' }}>
                <span className="dot" style={{ background: `#${TYPE_COLOR[type].toString(16).padStart(6, '0')}` }} />
                {TYPE_LABEL[type]} ({count})
              </span>
            ))}
          </div>
          <div className="cx3d-note">
            AI-guessed labels are advisory only — they don't change cost basis, proceeds, or your estimated tax.
          </div>
        </>
      )}
    </div>
  );
}
