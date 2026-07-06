import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import UploadCSV from './UploadCSV';
import { computeLedger } from '../lib/costBasisMethods';

const WALLET_COLORS = [0xc9932f, 0x2fae66, 0x8fb3ff, 0xd64545, 0x9aa3b2, 0x6b7280];

/**
 * WalletManager
 * -------------
 * Lets a user add multiple wallets (each backed by its own CSV upload),
 * choose which ones count toward the tax calc, and see each wallet's own
 * subtotal alongside the combined total (computed in App.jsx from the
 * combined rows this component hands up via onWalletsChange).
 *
 * A wallet here is: { id, label, address, rows, included }
 * `address` is optional/informational only — no on-chain indexing is wired
 * up (that needs an Etherscan/Covalent-style API key), so a "public address"
 * wallet still needs its own CSV export to actually have transactions.
 */
export default function WalletManager({ taxMethod, onWalletsChange }) {
  const [wallets, setWallets] = useState([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    onWalletsChange(wallets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  function handleParsed(rows) {
    const id = crypto.randomUUID();
    setWallets((w) => [
      ...w,
      {
        id,
        label: label.trim() || `Wallet ${w.length + 1}`,
        address: address.trim() || null,
        rows,
        included: true,
      },
    ]);
    setLabel('');
    setAddress('');
    setAdding(false);
  }

  function toggleIncluded(id) {
    setWallets((w) => w.map((x) => (x.id === id ? { ...x, included: !x.included } : x)));
  }

  function removeWallet(id) {
    setWallets((w) => w.filter((x) => x.id !== id));
  }

  const includedCount = wallets.filter((w) => w.included).length;

  return (
    <div className="wallet-manager">
      <style>{`
        .wallet-manager { background:#000; border-radius:12px; padding:20px; font-family: ui-monospace, 'IBM Plex Mono', monospace; }
        .wallet-manager__title { font-size:13px; text-transform:uppercase; letter-spacing:1.5px; color:#c9932f; margin:0 0 4px; }
        .wallet-manager__sub { font-size:11px; color:#6b7280; margin:0 0 16px; }
        .wallet-manager__grid { display:flex; gap:14px; flex-wrap:wrap; }
        .wallet-card { background:rgba(255,255,255,0.03); border:1px solid #1a2733; border-radius:10px; padding:14px; width:220px; display:flex; flex-direction:column; gap:8px; }
        .wallet-card--excluded { opacity:0.45; }
        .wallet-card__row { display:flex; align-items:center; justify-content:space-between; }
        .wallet-card__label { color:#e9efec; font-size:13px; font-weight:600; }
        .wallet-card__address { color:#6b7280; font-size:10px; word-break:break-all; }
        .wallet-card__stat { display:flex; justify-content:space-between; font-size:11px; color:#9aa3b2; }
        .wallet-card__stat b { color:#c8cdd6; }
        .wallet-card__actions { display:flex; justify-content:space-between; align-items:center; margin-top:4px; }
        .wallet-card__remove { background:none; border:none; color:#6b7280; font-size:10.5px; cursor:pointer; text-decoration:underline; }
        .wallet-card__remove:hover { color:#d64545; }
        .wallet-card__toggle { display:flex; align-items:center; gap:6px; font-size:10.5px; color:#9aa3b2; cursor:pointer; }
        .wallet-add { border:1px dashed #232c3a; border-radius:10px; width:220px; display:flex; align-items:center; justify-content:center; color:#6b7280; font-size:12px; cursor:pointer; min-height:150px; text-align:center; padding:14px; }
        .wallet-add:hover { border-color:#c9932f; color:#c9932f; }
        .wallet-add-form { background:rgba(255,255,255,0.03); border:1px solid #1a2733; border-radius:10px; padding:16px; width:100%; max-width:360px; display:flex; flex-direction:column; gap:10px; margin-top:14px; }
        .wallet-add-form input { background:#000; border:1px solid #232c3a; color:#e9efec; border-radius:6px; padding:8px 10px; font-size:12px; font-family:inherit; }
        .wallet-add-form input:focus { outline:none; border-color:#c9932f; }
        .wallet-add-form__cancel { background:none; border:none; color:#6b7280; font-size:11px; cursor:pointer; align-self:flex-start; }
      `}</style>

      <p className="wallet-manager__title">Wallets</p>
      <p className="wallet-manager__sub">
        {wallets.length === 0
          ? 'Add a wallet to start — each one is its own CSV upload.'
          : `${includedCount} of ${wallets.length} wallet${wallets.length === 1 ? '' : 's'} included in the tax calc`}
      </p>

      <div className="wallet-manager__grid">
        {wallets.map((wallet, i) => (
          <WalletCard
            key={wallet.id}
            wallet={wallet}
            color={WALLET_COLORS[i % WALLET_COLORS.length]}
            taxMethod={taxMethod}
            onToggle={() => toggleIncluded(wallet.id)}
            onRemove={() => removeWallet(wallet.id)}
          />
        ))}

        {!adding && (
          <div className="wallet-add" onClick={() => setAdding(true)}>
            + Add a wallet
            <br />
            (CSV or public address label)
          </div>
        )}
      </div>

      {adding && (
        <div className="wallet-add-form">
          <input
            placeholder="Wallet label (e.g. Coinbase, Ledger)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            placeholder="Public address (optional, for reference only)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <UploadCSV onParsed={handleParsed} />
          <button className="wallet-add-form__cancel" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function WalletCard({ wallet, color, taxMethod, onToggle, onRemove }) {
  const summary = wallet.rows.length ? computeLedger(wallet.rows, taxMethod).summary : null;

  return (
    <div className={`wallet-card${wallet.included ? '' : ' wallet-card--excluded'}`}>
      <div className="wallet-card__row">
        <span className="wallet-card__label">{wallet.label}</span>
        <WalletToken3D color={color} spinning={wallet.included} />
      </div>
      {wallet.address && <span className="wallet-card__address">{wallet.address}</span>}

      {summary && (
        <>
          <div className="wallet-card__stat">
            <span>Transactions</span>
            <b>{summary.transactionCount}</b>
          </div>
          <div className="wallet-card__stat">
            <span>Net realized</span>
            <b style={{ color: summary.totalGain >= 0 ? '#2fae66' : '#d64545' }}>
              {summary.totalGain >= 0 ? '+' : ''}
              {summary.totalGain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </b>
          </div>
        </>
      )}

      <div className="wallet-card__actions">
        <label className="wallet-card__toggle">
          <input type="checkbox" checked={wallet.included} onChange={onToggle} />
          {wallet.included ? 'Included' : 'Excluded'}
        </label>
        <button className="wallet-card__remove" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

function WalletToken3D({ color = 0xc9932f, spinning = true }) {
  const mountRef = useRef(null);
  const size = 40;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    camera.position.set(0, 0, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(2, 3, 3);
    scene.add(key);

    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.4 })
    );
    scene.add(mesh);

    let frameId;
    let t = 0;
    const animate = () => {
      t += spinning ? 0.02 : 0.004;
      mesh.rotation.y = t;
      mesh.rotation.x = Math.sin(t * 0.5) * 0.3;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      mesh.geometry.dispose();
      mesh.material.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [color, spinning]);

  return <div ref={mountRef} style={{ width: size, height: size, flexShrink: 0 }} />;
}
