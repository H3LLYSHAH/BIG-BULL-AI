import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import "./chatbot.css";

/**
 * ChatbotWidget
 * -------------
 * Floating "ask about your P/L" assistant. A pulsing 3D trading scene
 * (candlesticks, orbiting coin discs, a glowing AI core) renders on a
 * pure-black canvas behind the chat panel. Logic-side, it answers
 * questions about profit/loss using the `portfolio` you pass in — no
 * external AI call required, so it works the moment you wire real data in.
 *
 * Usage:
 *   <ChatbotWidget portfolio={[
 *     { asset: "BTC", quantity: 0.42, avgBuyPrice: 51000, currentPrice: 63551 },
 *     { asset: "ETH", quantity: 3.1,  avgBuyPrice: 1900,  currentPrice: 1782.8 },
 *   ]} />
 *
 * Swap `answerQuestion` for a real LLM call later — the function boundary
 * is deliberately isolated so you can drop in a fetch() to your own API
 * without touching the 3D scene or chat UI.
 */

// ---------------------------------------------------------------------
// 3D scene: black background, candlesticks, orbiting "coins", glowing core
// ---------------------------------------------------------------------
function ChatbotScene({ mountRef, thinking }) {
  const stateRef = useRef({});

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0.6, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x223344, 1.1));
    const key = new THREE.PointLight(0x00d4ff, 3, 30);
    key.position.set(4, 5, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0x2dd6a0, 2, 30);
    rim.position.set(-5, -3, 4);
    scene.add(rim);

    // --- Glowing AI core (the "avatar") --------------------------------
    const coreGroup = new THREE.Group();
    const coreGeo = new THREE.IcosahedronGeometry(0.85, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.6,
      wireframe: true,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(core);

    const haloGeo = new THREE.TorusGeometry(1.3, 0.02, 8, 64);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x2dd6a0, transparent: true, opacity: 0.5 });
    const halo1 = new THREE.Mesh(haloGeo, haloMat);
    halo1.rotation.x = Math.PI / 2.4;
    const halo2 = new THREE.Mesh(haloGeo, haloMat.clone());
    halo2.rotation.x = Math.PI / 1.6;
    halo2.scale.setScalar(1.25);
    coreGroup.add(halo1, halo2);
    scene.add(coreGroup);

    // --- Mini candlestick strip beneath the core -----------------------
    const BAR_COUNT = 14;
    const SPACING = 0.32;
    const chartGroup = new THREE.Group();
    chartGroup.position.set(-((BAR_COUNT - 1) * SPACING) / 2, -1.9, -1.5);
    let price = 3;
    const bars = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const open = price;
      price += (Math.random() - 0.47) * 0.9;
      price = Math.max(0.4, price);
      const close = price;
      const isBull = close >= open;
      const bodyH = Math.max(0.12, Math.abs(close - open));
      const mat = new THREE.MeshStandardMaterial({
        color: isBull ? 0x2dd6a0 : 0xff4d6d,
        emissive: isBull ? 0x2dd6a0 : 0xff4d6d,
        emissiveIntensity: 0.4,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, bodyH, 0.16), mat);
      body.position.set(i * SPACING, (open + close) / 2, 0);
      chartGroup.add(body);
      bars.push({ body, tick: Math.random() * 2 });
    }
    scene.add(chartGroup);

    // --- Orbiting coin discs (BTC / ETH / SOL) --------------------------
    const coinColors = [0xf7931a, 0x627eea, 0x00ffa3];
    const coins = coinColors.map((color, idx) => {
      const geo = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 32);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        metalness: 0.7,
        roughness: 0.3,
      });
      const coin = new THREE.Mesh(geo, mat);
      coin.rotation.x = Math.PI / 2.2;
      scene.add(coin);
      return { coin, radius: 2.4, speed: 0.4 + idx * 0.15, offset: (idx / coinColors.length) * Math.PI * 2, yBase: 0.4 };
    });

    // --- Sparse particle drift -----------------------------------------
    const PARTICLES = 220;
    const positions = new Float32Array(PARTICLES * 3);
    for (let i = 0; i < PARTICLES; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x6fb6ff, size: 0.035, transparent: true, opacity: 0.5 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    const clock = new THREE.Clock();
    let frameId;

    function animate() {
      const delta = clock.getDelta();
      const t = clock.getElapsedTime();

      const pulse = stateRef.current.thinking ? 1.8 : 1;
      coreGroup.rotation.y += delta * 0.4 * pulse;
      coreGroup.rotation.x = Math.sin(t * 0.5) * 0.15;
      core.material.emissiveIntensity = 0.45 + Math.sin(t * (stateRef.current.thinking ? 6 : 2)) * 0.2;
      halo1.rotation.z += delta * 0.3 * pulse;
      halo2.rotation.z -= delta * 0.2 * pulse;

      coins.forEach((c, i) => {
        const angle = t * c.speed + c.offset;
        c.coin.position.set(Math.cos(angle) * c.radius, c.yBase + Math.sin(t * 0.8 + i) * 0.2, Math.sin(angle) * c.radius - 1);
        c.coin.rotation.z += delta * 1.2;
      });

      bars.forEach((bar) => {
        bar.tick -= delta;
        if (bar.tick <= 0) {
          bar.tick = 1 + Math.random() * 2;
          bar.body.material.emissiveIntensity = 0.8;
        } else {
          bar.body.material.emissiveIntensity = THREE.MathUtils.lerp(bar.body.material.emissiveIntensity, 0.4, delta * 1.5);
        }
      });

      particles.rotation.y += delta * 0.015;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    animate();

    function handleResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      pGeo.dispose();
      pMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      bars.forEach((b) => {
        b.body.geometry.dispose();
        b.body.material.dispose();
      });
      coins.forEach((c) => {
        c.coin.geometry.dispose();
        c.coin.material.dispose();
      });
    };
  }, [mountRef]);

  useEffect(() => {
    stateRef.current.thinking = thinking;
  }, [thinking]);

  return null;
}

// ---------------------------------------------------------------------
// Answer engine — swap this for a real API call whenever you're ready
// ---------------------------------------------------------------------
function computeSummary(portfolio) {
  return portfolio.map((p) => {
    const pl = (p.currentPrice - p.avgBuyPrice) * p.quantity;
    const plPct = ((p.currentPrice - p.avgBuyPrice) / p.avgBuyPrice) * 100;
    return { ...p, pl, plPct };
  });
}

function answerQuestion(question, portfolio) {
  const q = question.toLowerCase();
  const rows = computeSummary(portfolio);

  if (!rows.length) {
    return "You don't have any holdings loaded yet — upload a wallet CSV and I can break down your profit and loss.";
  }

  const totalPL = rows.reduce((sum, r) => sum + r.pl, 0);
  const mentioned = rows.find((r) => q.includes(r.asset.toLowerCase()));

  if (mentioned) {
    const dir = mentioned.pl >= 0 ? "up" : "down";
    return `${mentioned.asset} is currently ${dir} ${Math.abs(mentioned.plPct).toFixed(1)}% — that's ${
      mentioned.pl >= 0 ? "a gain" : "a loss"
    } of $${Math.abs(mentioned.pl).toFixed(2)} on your ${mentioned.quantity} ${mentioned.asset}.`;
  }

  if (q.includes("overall") || q.includes("total") || q.includes("portfolio") || q.includes("profit") || q.includes("loss")) {
    const best = [...rows].sort((a, b) => b.plPct - a.plPct)[0];
    const worst = [...rows].sort((a, b) => a.plPct - b.plPct)[0];
    return `Overall you're ${totalPL >= 0 ? "up" : "down"} $${Math.abs(totalPL).toFixed(2)} right now. ${best.asset} is your best performer (${best.plPct >= 0 ? "+" : ""}${best.plPct.toFixed(1)}%), and ${worst.asset} is your weakest (${worst.plPct >= 0 ? "+" : ""}${worst.plPct.toFixed(1)}%).`;
  }

  return "Ask me things like \"am I in profit on BTC?\" or \"what's my overall P/L?\" and I'll break it down using your current holdings.";
}

// ---------------------------------------------------------------------
// Chat panel
// ---------------------------------------------------------------------
export default function ChatbotWidget({ portfolio = [] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Ask me whether you're in profit or loss on any holding, or your portfolio overall." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const mountRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const reply = answerQuestion(text, portfolio);
      setMessages((m) => [...m, { role: "bot", text: reply }]);
      setThinking(false);
    }, 500 + Math.random() * 500);
  }, [input, portfolio]);

  return (
    <div className={`cbw ${open ? "cbw--open" : ""}`}>
      {open && (
        <div className="cbw__panel">
          <div className="cbw__scene" ref={mountRef}>
            <ChatbotScene mountRef={mountRef} thinking={thinking} />
          </div>
          <div className="cbw__overlay">
            <div className="cbw__header">
              <span className="cbw__title">P/L Assistant</span>
              <button className="cbw__close" onClick={() => setOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>
            <div className="cbw__messages" ref={scrollRef}>
              {messages.map((m, i) => (
                <div key={i} className={`cbw__bubble cbw__bubble--${m.role}`}>
                  {m.text}
                </div>
              ))}
              {thinking && <div className="cbw__bubble cbw__bubble--bot cbw__bubble--thinking">…</div>}
            </div>
            <div className="cbw__inputRow">
              <input
                className="cbw__input"
                value={input}
                placeholder="Am I up on ETH?"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button className="cbw__send" onClick={send} aria-label="Send">
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
      <button className="cbw__fab" onClick={() => setOpen((o) => !o)} aria-label="Toggle P/L assistant">
        <span className="cbw__fab-dot" />
      </button>
    </div>
  );
}
