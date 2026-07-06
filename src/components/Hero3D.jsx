import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hero3D
 * ------
 * Fullscreen animated 3D background: a floating candlestick chart that
 * ticks like a live feed, plus a drifting particle field for depth.
 *
 * Requires: npm install three
 *
 * Drop <Hero3D /> as an absolutely-positioned background layer behind your
 * hero copy (see LandingPage.jsx for the wiring). It fills its parent
 * container, so give the parent `position: relative` and a fixed height.
 */
export default function Hero3D() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // --- Scene / camera / renderer ---------------------------------
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.5, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // --- Lights ------------------------------------------------------
    scene.add(new THREE.AmbientLight(0x445566, 1.2));
    const keyLight = new THREE.PointLight(0x00d4ff, 2.5, 40);
    keyLight.position.set(6, 8, 8);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x2dd6a0, 1.5, 40);
    rimLight.position.set(-8, -4, 6);
    scene.add(rimLight);

    // --- Candlestick chart --------------------------------------------
    const BAR_COUNT = 22;
    const SPACING = 0.9;
    const bullColor = new THREE.Color(0x2dd6a0);
    const bearColor = new THREE.Color(0xff4d6d);

    const chartGroup = new THREE.Group();
    chartGroup.position.x = -((BAR_COUNT - 1) * SPACING) / 2;
    scene.add(chartGroup);

    // Simple random-walk "price" series so the chart feels like real
    // market data without representing any actual asset.
    let price = 5;
    const bars = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const open = price;
      price += (Math.random() - 0.48) * 2.2;
      price = Math.max(0.6, price);
      const close = price;
      const high = Math.max(open, close) + Math.random() * 0.6;
      const low = Math.min(open, close) - Math.random() * 0.6;

      const isBull = close >= open;
      const bodyHeight = Math.max(0.15, Math.abs(close - open));
      const bodyMat = new THREE.MeshStandardMaterial({
        color: isBull ? bullColor : bearColor,
        emissive: isBull ? bullColor : bearColor,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0.2,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, bodyHeight, 0.45), bodyMat);
      body.position.set(i * SPACING, (open + close) / 2, 0);

      const wickMat = new THREE.MeshStandardMaterial({
        color: isBull ? bullColor : bearColor,
        emissive: isBull ? bullColor : bearColor,
        emissiveIntensity: 0.2,
      });
      const wick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, high - low, 8),
        wickMat
      );
      wick.position.set(i * SPACING, (high + low) / 2, 0);

      chartGroup.add(body, wick);
      bars.push({ body, wick, open, close, high, low, isBull, tickCooldown: Math.random() * 2 });
    }
    chartGroup.position.y = -2.5;

    // --- Particle field -------------------------------------------
    const PARTICLE_COUNT = 500;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 24;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x6fb6ff,
      size: 0.05,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- Animation loop ----------------------------------------------
    const clock = new THREE.Clock();
    let frameId;

    function animate() {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Gentle orbit around the chart.
      chartGroup.rotation.y = Math.sin(elapsed * 0.15) * 0.25;
      chartGroup.position.y = -2.5 + Math.sin(elapsed * 0.6) * 0.1;

      // Drift the particle field slowly for parallax depth.
      particles.rotation.y += delta * 0.02;
      particles.rotation.x += delta * 0.005;

      // Occasionally "tick" a random bar, like a live price update.
      bars.forEach((bar) => {
        bar.tickCooldown -= delta;
        if (bar.tickCooldown <= 0) {
          bar.tickCooldown = 1.5 + Math.random() * 3;
          const pulse = bar.isBull ? 0.6 : 0.15;
          bar.body.material.emissiveIntensity = pulse;
          bar.wick.material.emissiveIntensity = pulse * 0.7;
        } else {
          bar.body.material.emissiveIntensity = THREE.MathUtils.lerp(
            bar.body.material.emissiveIntensity,
            0.35,
            delta * 1.5
          );
        }
      });

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    animate();

    // --- Resize handling ----------------------------------------------
    function handleResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    // --- Cleanup -------------------------------------------------------
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      bars.forEach((bar) => {
        bar.body.geometry.dispose();
        bar.body.material.dispose();
        bar.wick.geometry.dispose();
        bar.wick.material.dispose();
      });
    };
  }, []);

  return <div ref={mountRef} className="hero3d" />;
}
