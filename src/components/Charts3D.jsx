import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Charts3D
 * --------
 * Three 3D bar-chart panels, black background, bars growing in on mount:
 *   1. Portfolio by token   — net quantity held per asset × its last trade price
 *   2. Yearly gain / loss   — realized gain/loss grouped by transaction year
 *   3. Transaction type mix — count of buy vs sell (or AI-classified types,
 *                             if `classifiedRows` is passed)
 *
 * Usage:
 *   <Charts3D rows={ledger.rows} classifiedRows={aiClassifiedRows} />
 * `rows` should be the ledger rows: { date, asset, side, quantity, price, gain }
 */
export default function Charts3D({ rows = [], classifiedRows = null }) {
  const portfolio = summarizePortfolio(rows);
  const yearly = summarizeYearly(rows);
  const typeMix = classifiedRows ? summarizeClassified(classifiedRows) : summarizeBuySell(rows);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <ChartPanel title="Portfolio by token" data={portfolio} colorMode="neutral" />
      <ChartPanel title="Yearly gain / loss" data={yearly} colorMode="signed" />
      <ChartPanel title="Transaction mix" data={typeMix} colorMode="neutral" />
    </div>
  );
}

function summarizePortfolio(rows) {
  const byAsset = new Map();
  for (const r of rows) {
    const entry = byAsset.get(r.asset) || { qty: 0, lastPrice: 0 };
    entry.qty += r.side === 'buy' ? r.quantity : -r.quantity;
    entry.lastPrice = r.price;
    byAsset.set(r.asset, entry);
  }
  return [...byAsset.entries()]
    .map(([asset, { qty, lastPrice }]) => ({ label: asset, value: Math.max(0, qty) * lastPrice }))
    .filter((d) => d.value > 0);
}

function summarizeYearly(rows) {
  const byYear = new Map();
  for (const r of rows) {
    if (r.gain == null) continue;
    const year = new Date(r.date).getFullYear();
    byYear.set(year, (byYear.get(year) || 0) + r.gain);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, gain]) => ({ label: String(year), value: gain }));
}

function summarizeBuySell(rows) {
  const buy = rows.filter((r) => r.side === 'buy').length;
  const sell = rows.filter((r) => r.side === 'sell').length;
  return [
    { label: 'Buy', value: buy },
    { label: 'Sell', value: sell },
  ];
}

function summarizeClassified(classifiedRows) {
  const counts = new Map();
  for (const r of classifiedRows) {
    counts.set(r.predictedType, (counts.get(r.predictedType) || 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function ChartPanel({ title, data, colorMode }) {
  const mountRef = useRef(null);
  const width = 280;
  const height = 220;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || data.length === 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(4, 3.5, 7);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 6, 5);
    scene.add(key);

    const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1e-6);
    const spacing = 1.3;
    const startX = -((data.length - 1) * spacing) / 2;

    const GREEN = 0x2fae66;
    const RED = 0xd64545;
    const GOLD = 0xc9932f;

    const bars = data.map((d, i) => {
      const targetHeight = Math.max(0.15, (Math.abs(d.value) / maxAbs) * 3);
      const color = colorMode === 'signed' ? (d.value >= 0 ? GREEN : RED) : GOLD;

      const geo = new THREE.BoxGeometry(0.7, 1, 0.7);
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = startX + i * spacing;
      mesh.scale.y = 0.001;
      mesh.position.y = 0;
      scene.add(mesh);
      return { mesh, targetHeight };
    });

    let frameId;
    const animate = () => {
      bars.forEach(({ mesh, targetHeight }) => {
        const currentH = mesh.scale.y;
        const nextH = currentH + (targetHeight - currentH) * 0.08;
        mesh.scale.y = nextH;
        mesh.position.y = nextH / 2;
      });
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      bars.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [JSON.stringify(data), colorMode]);

  return (
    <div style={{ background: '#000000', borderRadius: 10, padding: 16, width: 'fit-content' }}>
      <div
        style={{
          fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: '#9aa3b2',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {data.length === 0 ? (
        <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 12, fontFamily: 'monospace' }}>
          No data yet
        </div>
      ) : (
        <div ref={mountRef} style={{ width, height }} />
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        {data.map((d) => (
          <span key={d.label} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: '#6b7280' }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
