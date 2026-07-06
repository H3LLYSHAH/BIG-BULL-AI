import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { hashReport } from '../lib/reportHash';
import { anchorReportHash, verifyReportHash } from '../lib/anchorProof';

/**
 * ProofOfExistenceSeal
 * ---------------------
 * "Proof on Blockchain" feature.
 *
 * 1. Hashes the finished report (transactions + summary) with SHA-256.
 * 2. Lets the user anchor that hash on-chain (Polygon Amoy testnet) via
 *    their wallet, or check whether it was already anchored.
 * 3. Shows: report hash, Ethereum/Polygon tx hash, and verification status.
 *
 * A rotating 3D wax-seal / medallion spins on a black background to give
 * the feature a "certified" feel, and changes color with status.
 */
export default function ProofOfExistenceSeal({ transactions, summary, uid }) {
  const [reportHash, setReportHash] = useState(null);
  const [status, setStatus] = useState('hashing'); // hashing | ready | anchoring | anchored | verifying | verified | not_found | error
  const [txHash, setTxHash] = useState(null);
  const [anchoredAt, setAnchoredAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('hashing');
    setError(null);
    hashReport({ transactions, summary, uid })
      .then((hash) => {
        if (!cancelled) {
          setReportHash(hash);
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not hash this report.');
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [transactions, summary, uid]);

  async function handleAnchor() {
    if (!reportHash) return;
    setStatus('anchoring');
    setError(null);
    try {
      const { txHash: hash } = await anchorReportHash(reportHash);
      setTxHash(hash);
      setAnchoredAt(new Date());
      setStatus('anchored');
    } catch (err) {
      setError(err.message || 'Could not anchor the report on-chain.');
      setStatus('error');
    }
  }

  async function handleVerify() {
    if (!reportHash) return;
    setStatus('verifying');
    setError(null);
    try {
      const result = await verifyReportHash(reportHash);
      if (result.exists) {
        setTxHash((prev) => prev ?? null);
        setAnchoredAt(result.timestamp);
        setStatus('verified');
      } else {
        setStatus('not_found');
      }
    } catch (err) {
      setError(err.message || 'Could not verify against the chain.');
      setStatus('error');
    }
  }

  const sealTone =
    status === 'anchored' || status === 'verified'
      ? 'gold'
      : status === 'error' || status === 'not_found'
      ? 'red'
      : 'neutral';

  return (
    <div className="poe-seal">
      <style>{`
        .poe-seal { background:#000; border-radius:12px; padding:20px; display:flex; gap:20px; flex-wrap:wrap; align-items:center; }
        .poe-seal__info { flex:1; min-width:260px; font-family: ui-monospace, 'IBM Plex Mono', monospace; }
        .poe-seal__title { font-size:13px; text-transform:uppercase; letter-spacing:1.5px; color:#c9932f; margin:0 0 6px; }
        .poe-seal__hash { font-size:11px; color:#9aa3b2; word-break:break-all; background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:6px; margin-bottom:10px; }
        .poe-seal__row { font-size:12px; color:#c8cdd6; margin-bottom:4px; }
        .poe-seal__row span.label { color:#6b7280; margin-right:6px; }
        .poe-seal__actions { display:flex; gap:10px; margin-top:12px; flex-wrap:wrap; }
        .poe-seal__btn { background:transparent; border:1px solid #232c3a; color:#c8cdd6; border-radius:6px; padding:8px 14px; font-size:11.5px; font-family:inherit; text-transform:uppercase; letter-spacing:1px; cursor:pointer; }
        .poe-seal__btn:hover { border-color:#c9932f; color:#c9932f; }
        .poe-seal__btn:disabled { opacity:0.5; cursor:not-allowed; }
        .poe-seal__status--anchored, .poe-seal__status--verified { color:#2fae66; }
        .poe-seal__status--error, .poe-seal__status--not_found { color:#d64545; }
        .poe-seal__status--anchoring, .poe-seal__status--verifying, .poe-seal__status--hashing { color:#9aa3b2; }
      `}</style>

      <SealCanvas tone={sealTone} spinning={status === 'anchoring' || status === 'verifying' || status === 'hashing'} />

      <div className="poe-seal__info">
        <p className="poe-seal__title">Proof on Blockchain</p>

        {reportHash && (
          <div className="poe-seal__hash">{reportHash}</div>
        )}

        <p className="poe-seal__row">
          <span className="label">Report hash:</span>
          {status === 'hashing' ? 'computing…' : 'SHA-256, above'}
        </p>
        <p className="poe-seal__row">
          <span className="label">Tx hash:</span>
          {txHash ? txHash : '— not anchored yet —'}
        </p>
        <p className={`poe-seal__row poe-seal__status--${status}`}>
          <span className="label">Status:</span>
          {statusLabel(status, error)}
        </p>
        {anchoredAt && (
          <p className="poe-seal__row">
            <span className="label">Anchored:</span>
            {anchoredAt.toLocaleString()}
          </p>
        )}

        <div className="poe-seal__actions">
          <button
            className="poe-seal__btn"
            onClick={handleAnchor}
            disabled={!reportHash || status === 'anchoring' || status === 'verifying'}
          >
            Anchor on-chain
          </button>
          <button
            className="poe-seal__btn"
            onClick={handleVerify}
            disabled={!reportHash || status === 'anchoring' || status === 'verifying'}
          >
            Verify proof
          </button>
        </div>

        <p style={{ fontSize: 10.5, color: '#6b7280', marginTop: 10, maxWidth: 420 }}>
          Anchoring writes only the report's hash to Polygon Amoy testnet — never the
          underlying transactions — and requires a wallet (e.g. MetaMask) with test MATIC.
        </p>
      </div>
    </div>
  );
}

function statusLabel(status, error) {
  switch (status) {
    case 'hashing':
      return 'Hashing report…';
    case 'ready':
      return 'Hashed — not yet anchored';
    case 'anchoring':
      return 'Anchoring on-chain…';
    case 'anchored':
      return 'Anchored on-chain ✓';
    case 'verifying':
      return 'Checking chain…';
    case 'verified':
      return 'Verified on-chain ✓';
    case 'not_found':
      return 'Not found on-chain';
    case 'error':
      return error || 'Something went wrong';
    default:
      return status;
  }
}

function SealCanvas({ tone = 'neutral', spinning = false }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const size = 140;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 6, 6);
    scene.add(key);

    const colorFor = (t) =>
      t === 'gold' ? 0xc9932f : t === 'red' ? 0xd64545 : 0x6b7280;

    const group = new THREE.Group();
    scene.add(group);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.18, 16, 48),
      new THREE.MeshStandardMaterial({ color: colorFor(tone), metalness: 0.5, roughness: 0.35 })
    );
    group.add(ring);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.25, 48),
      new THREE.MeshStandardMaterial({ color: 0x111318, metalness: 0.3, roughness: 0.5 })
    );
    disc.rotation.x = Math.PI / 2;
    group.add(disc);

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({ color: colorFor(tone), metalness: 0.6, roughness: 0.2, emissive: colorFor(tone), emissiveIntensity: 0.2 })
    );
    gem.position.z = 0.3;
    group.add(gem);

    let frameId;
    let t = 0;
    const animate = () => {
      t += spinning ? 0.03 : 0.008;
      group.rotation.y = t;
      group.rotation.x = Math.sin(t * 0.4) * 0.15;
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
  }, [tone, spinning]);

  return <div ref={mountRef} style={{ width: 140, height: 140, flexShrink: 0 }} />;
}
