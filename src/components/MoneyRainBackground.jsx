import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const BILL_COUNT = 55;

// Draws a stylized bill face onto a canvas
function createBillTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#9db894';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#f2eedd';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2, 60 + i * 22, 34 + i * 12, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(35, 48, 38, 0.55)';
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height / 2, 46, 58, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f4f1e4';
  ctx.font = 'bold 46px Georgia, serif';
  ctx.fillText('100', 26, 62);
  ctx.fillText('100', canvas.width - 130, canvas.height - 30);

  ctx.fillStyle = 'rgba(244,241,228,0.45)';
  ctx.font = 'bold 72px Georgia, serif';
  ctx.fillText('$', canvas.width / 2 - 20, canvas.height / 2 + 26);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

// Base price trajectory used both to generate historical candles and to place
// the annotation lines, so the overlay always tracks the actual price action.
const PRICE_ANCHORS = [
  [0, 58000], [6, 51000], [12, 45000], [18, 40000],
  [24, 35500], [30, 34200], [36, 33200], [45, 32000],
  [48, 36500], [52, 39500], [57, 43500], [62, 47000],
  [66, 49500], [69, 45000],
];

function basePriceAt(index) {
  for (let i = 0; i < PRICE_ANCHORS.length - 1; i++) {
    const [i0, p0] = PRICE_ANCHORS[i];
    const [i1, p1] = PRICE_ANCHORS[i + 1];
    if (index >= i0 && index <= i1) {
      const t = (index - i0) / (i1 - i0);
      return p0 + (p1 - p0) * t;
    }
  }
  return PRICE_ANCHORS[PRICE_ANCHORS.length - 1][1];
}

// Builds the fixed historical pattern: macro downtrend -> falling wedge -> breakout -> reversal
function buildHistoricalBars() {
  const bars = [];
  let prevClose = basePriceAt(0) + 400;
  for (let i = 0; i < 70; i++) {
    const base = basePriceAt(i);
    const gap = (Math.random() - 0.5) * 220;
    const open = prevClose + gap;
    const drift = (Math.random() - 0.5) * 700;
    const close = base + drift;
    const wick = 250 + Math.random() * 350;
    const high = Math.max(open, close) + Math.random() * wick;
    const low = Math.min(open, close) - Math.random() * wick;
    bars.push({ open, high, low, close });
    prevClose = close;
  }
  return bars;
}

const VIEW_COUNT = 70;
const NEW_BAR_TICKS = 9;

function drawArrow(ctx, x1, y1, x2, y2, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 9;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Generates and manages a live, annotated BTC/USD-style candlestick chart on canvas,
// rendered as a 3D texture behind the falling money.
class TradingChartTextureManager {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1536;
    this.canvas.height = 800;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);

    this.bars = buildHistoricalBars();
    const lastClose = this.bars[this.bars.length - 1].close;
    this.liveBar = { open: lastClose, high: lastClose, low: lastClose, close: lastClose };
    this.barTickCount = 0;
    this.tickCounter = 0;
  }

  update(dt) {
    this.tickCounter += dt * 3.5;

    if (this.tickCounter > 1) {
      this.tickCounter = 0;
      const change = (Math.random() - 0.47) * (this.liveBar.close * 0.012);
      const newClose = Math.max(1000, this.liveBar.close + change);
      this.liveBar.close = newClose;
      this.liveBar.high = Math.max(this.liveBar.high, newClose);
      this.liveBar.low = Math.min(this.liveBar.low, newClose);

      this.barTickCount++;
      if (this.barTickCount >= NEW_BAR_TICKS) {
        this.barTickCount = 0;
        this.bars.push({ ...this.liveBar });
        this.liveBar = { open: newClose, high: newClose, low: newClose, close: newClose };
      }
    }

    this.draw();
    this.texture.needsUpdate = true;
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const plotLeft = 24;
    const plotRight = w - 130;
    const plotTop = 70;
    const plotBottom = h - 60;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    ctx.fillStyle = '#131722';
    ctx.fillRect(0, 0, w, h);

    const allBars = [...this.bars, this.liveBar];
    const firstAbsIndex = allBars.length - VIEW_COUNT;
    const visible = allBars.slice(-VIEW_COUNT);
    const spacing = plotWidth / VIEW_COUNT;
    const candleWidth = Math.max(4, spacing * 0.6);

    const screenX = (absIndex) => plotLeft + (absIndex - firstAbsIndex) * spacing + spacing / 2;

    let minPrice = Infinity, maxPrice = -Infinity;
    for (const b of visible) {
      minPrice = Math.min(minPrice, b.low);
      maxPrice = Math.max(maxPrice, b.high);
    }
    const pad = (maxPrice - minPrice) * 0.08;
    minPrice -= pad;
    maxPrice += pad;
    const priceToY = (price) => plotBottom - ((price - minPrice) / (maxPrice - minPrice)) * plotHeight;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const gridLines = 7;
    ctx.font = '12px monospace';
    for (let i = 0; i <= gridLines; i++) {
      const y = plotTop + (plotHeight / gridLines) * i;
      ctx.beginPath(); ctx.moveTo(plotLeft, y); ctx.lineTo(plotRight, y); ctx.stroke();
      const price = maxPrice - ((maxPrice - minPrice) / gridLines) * i;
      ctx.fillStyle = 'rgba(210,220,230,0.55)';
      ctx.fillText(price.toFixed(2), plotRight + 12, y + 4);
    }
    const months = ['Jun', 'Jul', 'Aug', 'Sep'];
    for (let i = 0; i < months.length; i++) {
      const x = plotLeft + (plotWidth / months.length) * (i + 0.5);
      ctx.fillStyle = 'rgba(210,220,230,0.4)';
      ctx.fillText(months[i], x - 10, plotBottom + 22);
    }

    // Candles
    for (let i = 0; i < visible.length; i++) {
      const bar = visible[i];
      const absIndex = firstAbsIndex + i;
      const x = screenX(absIndex);
      const isUp = bar.close >= bar.open;
      const color = isUp ? '#26a69a' : '#ef5350';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, priceToY(bar.high));
      ctx.lineTo(x, priceToY(bar.low));
      ctx.stroke();
      const bodyTop = priceToY(Math.max(bar.open, bar.close));
      const bodyBottom = priceToY(Math.min(bar.open, bar.close));
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, Math.max(1.5, bodyBottom - bodyTop));
    }

    // --- Annotations (skip once their bars have scrolled out of view) ---
    const inView = (idx) => idx >= firstAbsIndex && idx <= firstAbsIndex + VIEW_COUNT;
    const pt = (idx, price) => [screenX(idx), priceToY(price)];

    if (inView(1) || inView(23)) {
      const [x1, y1] = pt(1, 58000);
      const [x2, y2] = pt(23, 35800);
      drawArrow(ctx, x1, y1, x2, y2, '#ef5350');
      ctx.fillStyle = '#e8ecef';
      ctx.font = '15px sans-serif';
      ctx.fillText('Macro downtrend', (x1 + x2) / 2 - 55, (y1 + y2) / 2 - 14);
    }

    if (inView(24) && inView(45)) {
      const [ux1, uy1] = pt(24, 36500);
      const [ux2, uy2] = pt(45, 33000);
      const [lx1, ly1] = pt(26, 33200);
      const [lx2, ly2] = pt(45, 31700);
      ctx.strokeStyle = '#4fa8e0';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ux1, uy1); ctx.lineTo(ux2, uy2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx1, ly1); ctx.lineTo(lx2, ly2); ctx.stroke();

      ctx.fillStyle = '#e8ecef';
      ctx.font = '15px sans-serif';
      ctx.fillText('Lower Highs', ux1 - 10, uy1 - 40);
      [0.25, 0.55, 0.85].forEach((t) => {
        const tx = ux1 + (ux2 - ux1) * t;
        const ty = uy1 + (uy2 - uy1) * t;
        drawArrow(ctx, ux1 + 30, uy1 - 26, tx, ty - 6, '#e8ecef');
      });

      ctx.fillText('Lower Lows', lx1 - 10, ly2 + 46);
      [0.2, 0.5, 0.8].forEach((t) => {
        const tx = lx1 + (lx2 - lx1) * t;
        const ty = ly1 + (ly2 - ly1) * t;
        drawArrow(ctx, lx1 + 10, ly2 + 30, tx, ty + 6, '#e8ecef');
      });
    }

    if (inView(45) && inView(48)) {
      const [bx, by] = pt(46, 32200);
      const [tx, ty] = pt(46, 35800);
      drawArrow(ctx, bx + 60, by + 4, bx + 6, by - 2, '#ffffff');
      ctx.fillStyle = '#ffffff';
      ctx.font = '15px sans-serif';
      ctx.fillText('Breakout', bx + 66, by + 8);

      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(screenX(45), priceToY(37200));
      ctx.lineTo(screenX(50), priceToY(37200));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e8ecef';
      ctx.font = '13px sans-serif';
      ctx.fillText('1st target', screenX(46), priceToY(37200) - 32);
      ctx.fillText('wedge opening', screenX(46), priceToY(37200) - 16);
      ctx.fillText('projection', screenX(46), priceToY(37200));
    }

    if (inView(47) && inView(64)) {
      const x1 = screenX(47), y1 = priceToY(33800);
      const x2 = screenX(64), y2 = priceToY(48800);
      const cx = (x1 + x2) / 2 + 40, cy = Math.min(y1, y2) - 10;
      ctx.strokeStyle = '#00e676';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();
      const angle = Math.atan2(y2 - cy, x2 - cx);
      drawArrow(ctx, x2 - 14 * Math.cos(angle), y2 - 14 * Math.sin(angle), x2, y2, '#00e676');
      ctx.fillStyle = '#e8ecef';
      ctx.font = '15px sans-serif';
      ctx.fillText('Trend reversal', (x1 + x2) / 2 - 10, cy - 10);
    }

    // Ticker header
    const liveOpen = this.liveBar.open;
    const liveClose = this.liveBar.close;
    const change = liveClose - liveOpen;
    const pct = liveOpen ? (change / liveOpen) * 100 : 0;
    const up = change >= 0;

    ctx.fillStyle = '#4fd1e8';
    ctx.font = '13px monospace';
    ctx.fillText('BTC/USD · 24h · Bitstamp', plotLeft, 26);

    ctx.font = '13px monospace';
    ctx.fillStyle = '#b9c4cc';
    const ohlc = `O:${liveOpen.toFixed(2)} H:${this.liveBar.high.toFixed(2)} L:${this.liveBar.low.toFixed(2)} C:${liveClose.toFixed(2)}`;
    ctx.fillText(ohlc, plotLeft, 44);
    ctx.fillStyle = up ? '#00e676' : '#ff1744';
    ctx.fillText(`${up ? '+' : ''}${change.toFixed(2)} (${up ? '+' : ''}${pct.toFixed(2)}%)`, plotLeft + ctx.measureText(ohlc).width + 14, 44);
  }

  dispose() {
    this.texture.dispose();
  }
}

function randomizeBill(state, spawnAtTop) {
  state.x = (Math.random() - 0.5) * 34;
  state.y = spawnAtTop ? 20 + Math.random() * 14 : (Math.random() - 0.5) * 36;
  state.z = (Math.random() - 0.5) * 15; // Kept in front of background chart plane
  state.fallSpeed = 1.4 + Math.random() * 2.2;
  state.rotSpeedX = (Math.random() - 0.5) * 1.6;
  state.rotSpeedY = (Math.random() - 0.5) * 1.6;
  state.rotSpeedZ = (Math.random() - 0.5) * 1.2;
  state.swayAmp = 0.6 + Math.random() * 1.6;
  state.swayFreq = 0.4 + Math.random() * 0.6;
  state.swayPhase = Math.random() * Math.PI * 2;
  state.scale = 0.55 + Math.random() * 0.85;
}

export default function MoneyRainBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.z = 20;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x06090e, 1); // Dark crypto platform background tone
    mount.appendChild(renderer.domElement);

    // --- SETUP ANIMATED TRADING CHART PLANE ---
    const chartManager = new TradingChartTextureManager();
    const chartGeometry = new THREE.PlaneGeometry(58, 29);
    const chartMaterial = new THREE.MeshBasicMaterial({
      map: chartManager.texture,
      transparent: true,
      opacity: 0.65, // Allows money to overlay visibly
      depthWrite: false
    });
    const chartMesh = new THREE.Mesh(chartGeometry, chartMaterial);
    chartMesh.position.set(0, 0, -7); // Sat deep in the background layer, slightly closer for scale
    scene.add(chartMesh);

    // --- SETUP FALLING BILLS ---
    const billTexture = createBillTexture();
    const billGeometry = new THREE.PlaneGeometry(3.4, 1.46);
    const billMaterial = new THREE.MeshBasicMaterial({
      map: billTexture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const bills = [];
    for (let i = 0; i < BILL_COUNT; i++) {
      const mesh = new THREE.Mesh(billGeometry, billMaterial);
      const state = {};
      randomizeBill(state, false);
      mesh.position.set(state.x, state.y, state.z);
      mesh.scale.setScalar(state.scale);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(mesh);
      bills.push({ mesh, state });
    }

    const clock = new THREE.Clock();
    let frameId;

    const animate = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Update interactive canvas-backed chart metrics
      chartManager.update(dt);

      // Animate falling currency bills
      for (const bill of bills) {
        const { mesh, state } = bill;

        state.y -= state.fallSpeed * dt;
        mesh.rotation.x += state.rotSpeedX * dt;
        mesh.rotation.y += state.rotSpeedY * dt;
        mesh.rotation.z += state.rotSpeedZ * dt;

        const sway = Math.sin(t * state.swayFreq + state.swayPhase) * state.swayAmp;
        mesh.position.set(state.x + sway, state.y, state.z);

        if (state.y < -20) {
          randomizeBill(state, true);
          mesh.scale.setScalar(state.scale);
        }
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      mount.removeChild(renderer.domElement);

      // Cleanup custom textures and maps
      chartManager.dispose();
      chartGeometry.dispose();
      chartMaterial.dispose();

      billGeometry.dispose();
      billMaterial.dispose();
      billTexture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: '#06090e',
      }}
    />
  );
}
