import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TAX_METHODS, TAX_METHOD_LABELS } from '../lib/costBasisMethods';

/**
 * TaxMethodSelector
 * ------------------
 * Lets the user pick FIFO / LIFO / HIFO / WAC. The selected method renders
 * as a highlighted, gently floating 3D cube on a black background; the
 * others sit dimmer behind it. Clicking a label swaps which cube is "lit".
 *
 * Usage:
 *   const [method, setMethod] = useState('FIFO');
 *   <TaxMethodSelector value={method} onChange={setMethod} />
 *   const ledger = computeLedger(transactions, method);
 */
export default function TaxMethodSelector({ value = 'FIFO', onChange }) {
  const mountRef = useRef(null);
  const cubesRef = useRef([]);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const size = 90;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 1.5, 7);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size * TAX_METHODS.length + (TAX_METHODS.length - 1) * 14, size);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 6, 6);
    scene.add(key);

    const spacing = 2.2;
    const startX = -((TAX_METHODS.length - 1) * spacing) / 2;
    const cubes = TAX_METHODS.map((method, i) => {
      const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      const mat = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.3, roughness: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = startX + i * spacing;
      scene.add(mesh);
      return { method, mesh, mat, phase: i * 0.7 };
    });
    cubesRef.current = cubes;

    let frameId;
    let t = 0;
    const activeColor = new THREE.Color(0xc9932f);
    const dimColor = new THREE.Color(0x3a4152);
    const animate = () => {
      t += 0.02;
      cubes.forEach(({ mesh, mat, method, phase }) => {
        const isActive = method === valueRef.current;
        mesh.rotation.y += isActive ? 0.02 : 0.006;
        mesh.position.y = (isActive ? 0.15 : 0) + Math.sin(t * 1.4 + phase) * (isActive ? 0.18 : 0.06);
        const targetScale = isActive ? 1.15 : 0.85;
        mesh.scale.x += (targetScale - mesh.scale.x) * 0.1;
        mesh.scale.y += (targetScale - mesh.scale.y) * 0.1;
        mesh.scale.z += (targetScale - mesh.scale.z) * 0.1;
        mat.color.lerp(isActive ? activeColor : dimColor, 0.08);
      });
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      cubes.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ background: '#000000', borderRadius: 10, padding: 18, width: 'fit-content' }}>
      <div ref={mountRef} />
      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        {TAX_METHODS.map((method) => (
          <button
            key={method}
            onClick={() => onChange?.(method)}
            title={TAX_METHOD_LABELS[method]}
            style={{
              background: method === value ? '#c9932f' : 'transparent',
              color: method === value ? '#2a1c05' : '#9aa3b2',
              border: method === value ? 'none' : '1px solid #232c3a',
              borderRadius: 4,
              padding: '7px 12px',
              fontSize: 11.5,
              fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: 1,
              cursor: 'pointer',
            }}
          >
            {method}
          </button>
        ))}
      </div>
    </div>
  );
}
