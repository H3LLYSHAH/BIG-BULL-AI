import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const CARD_ASPECT = 1.6;
const COLS = 5;

// Draws one transaction's data onto a canvas that becomes the card's face texture
function drawCardTexture(row) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0c131b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#223140';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  const isBuy = row.side === 'buy';
  const sideColor = isBuy ? '#00e676' : '#ff1744';

  ctx.fillStyle = sideColor + '22';
  ctx.fillRect(24, 24, 130, 42);
  ctx.strokeStyle = sideColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 130, 42);
  ctx.fillStyle = sideColor;
  ctx.font = 'bold 20px monospace';
  ctx.fillText(row.side.toUpperCase(), 42, 51);

  ctx.fillStyle = '#e9efec';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText(row.asset, 24, 132);

  ctx.fillStyle = '#7e93a1';
  ctx.font = '17px monospace';
  const dateLabel = row.date instanceof Date ? row.date.toLocaleDateString() : String(row.date);
  ctx.fillText(dateLabel, 24, 160);

  ctx.fillStyle = '#d4af6a';
  ctx.font = '19px monospace';
  ctx.fillText(`QTY    ${row.quantity}`, 24, 208);
  ctx.fillText(`PRICE  $${Number(row.price).toFixed(2)}`, 24, 236);

  if (row.gain !== null && row.gain !== undefined) {
    const gColor = row.gain >= 0 ? '#00e676' : '#ff1744';
    ctx.fillStyle = gColor;
    ctx.font = 'bold 26px monospace';
    const sign = row.gain >= 0 ? '+' : '';
    ctx.fillText(`${sign}$${row.gain.toFixed(2)}`, 24, 284);
  } else {
    ctx.fillStyle = '#465a6a';
    ctx.font = '16px monospace';
    ctx.fillText('opening position', 24, 280);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

export default function TransactionCards3D({ rows }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !rows || rows.length === 0) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight || 480;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 22);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const cardGeo = new THREE.PlaneGeometry(CARD_ASPECT * 2.6, 2.6);
    const cols = Math.min(COLS, rows.length) || 1;
    const rowCount = Math.ceil(rows.length / cols);
    const spacingX = 3.5;
    const spacingY = 3.1;
    const offsetX = ((cols - 1) * spacingX) / 2;
    const offsetY = ((rowCount - 1) * spacingY) / 2;

    const cards = rows.map((row, i) => {
      const texture = drawCardTexture(row);
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(cardGeo, mat);

      const col = i % cols;
      const rIdx = Math.floor(i / cols);
      const target = { x: col * spacingX - offsetX, y: offsetY - rIdx * spacingY, z: 0 };

      mesh.position.set(
        target.x + (Math.random() - 0.5) * 4,
        target.y + 14 + Math.random() * 8,
        -6 - Math.random() * 4
      );
      mesh.rotation.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      scene.add(mesh);

      return {
        mesh,
        texture,
        mat,
        target,
        delay: i * 0.05,
        elapsed: 0,
        settled: false,
        idlePhase: Math.random() * Math.PI * 2,
      };
    });

    let pointerX = 0;
    let pointerY = 0;
    const handlePointerMove = (e) => {
      const rect = mount.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    mount.addEventListener('pointermove', handlePointerMove);

    const clock = new THREE.Clock();
    let frameId;

    const animate = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      for (const card of cards) {
        card.elapsed += dt;
        if (card.elapsed > card.delay) {
          const localT = Math.min(1, (card.elapsed - card.delay) / 0.9);
          const ease = 1 - Math.pow(1 - localT, 3);
          card.mesh.position.x += (card.target.x - card.mesh.position.x) * ease * 0.18;
          card.mesh.position.y += (card.target.y - card.mesh.position.y) * ease * 0.18;
          card.mesh.position.z += (card.target.z - card.mesh.position.z) * ease * 0.18;
          card.mesh.rotation.x += (0 - card.mesh.rotation.x) * ease * 0.15;
          card.mesh.rotation.y += (0 - card.mesh.rotation.y) * ease * 0.15;
          card.mesh.rotation.z += (0 - card.mesh.rotation.z) * ease * 0.15;
          if (localT >= 1) card.settled = true;
        }

        if (card.settled) {
          card.mesh.position.y += Math.sin(t * 0.8 + card.idlePhase) * 0.0025;
          card.mesh.rotation.y = Math.sin(t * 0.3 + card.idlePhase) * 0.05 + pointerX * 0.15;
          card.mesh.rotation.x = pointerY * -0.1;
        }
      }

      camera.position.x += (pointerX * 1.2 - camera.position.x) * 0.03;
      camera.position.y += (-pointerY * 0.8 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      mount.removeEventListener('pointermove', handlePointerMove);
      mount.removeChild(renderer.domElement);
      cards.forEach((c) => {
        c.texture.dispose();
        c.mat.dispose();
      });
      cardGeo.dispose();
      renderer.dispose();
    };
  }, [rows]);

  return <div ref={mountRef} className="cards3d-panel" />;
}
