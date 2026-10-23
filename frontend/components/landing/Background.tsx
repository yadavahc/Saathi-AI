"use client";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

/** Fixed light backdrop: pastel blobs, a soft dot grid and floating confetti that drifts away from the cursor. */
export function Background() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const c = canvas.current;
    if (!c || reduce) return;
    const ctx = c.getContext("2d")!;
    let w = 0, h = 0, raf = 0;
    const mouse = { x: -9999, y: -9999 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const colors = ["#a7f3d0", "#fde68a", "#c4b5fd", "#bae6fd", "#fecaca", "#bbf7d0"];
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number; shape: number };
    let pts: P[] = [];

    function resize() {
      w = c!.width = window.innerWidth * dpr;
      h = c!.height = window.innerHeight * dpr;
      c!.style.width = window.innerWidth + "px";
      c!.style.height = window.innerHeight + "px";
      const n = Math.min(38, Math.round((window.innerWidth * window.innerHeight) / 42000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.18 * dpr, vy: (Math.random() - 0.5) * 0.18 * dpr,
        r: (Math.random() * 4 + 3) * dpr, c: colors[Math.floor(Math.random() * colors.length)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.01,
        shape: Math.floor(Math.random() * 3),
      }));
    }
    function frame() {
      // keep the hero plain: confetti fades in only after the first screen
      const vh = window.innerHeight;
      c!.style.opacity = String(Math.min(1, Math.max(0, (window.scrollY - vh * 0.45) / (vh * 0.4))));
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy) || 1;
        if (d < 150 * dpr) { p.vx += (dx / d) * 0.05; p.vy += (dy / d) * 0.05; }
        p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.x < -20 || p.x > w + 20) p.vx *= -1;
        if (p.y < -20 || p.y > h + 20) p.vy *= -1;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.globalAlpha = 0.75;
        ctx.beginPath();
        if (p.shape === 0) ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        else if (p.shape === 1) ctx.roundRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9, p.r * 0.45);
        else { ctx.moveTo(0, -p.r); ctx.lineTo(p.r, p.r); ctx.lineTo(-p.r, p.r); ctx.closePath(); }
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    const onMove = (e: MouseEvent) => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; };
    resize();
    frame();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMove); };
  }, [reduce]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#f7f8fc]" />
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="dot-grid absolute inset-0" />
      <canvas ref={canvas} className="absolute inset-0" />
    </div>
  );
}

/** Gradient bar showing how far the page has scrolled. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  return <motion.div style={{ scaleX }} className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />;
}

/** Soft glow that trails the cursor (desktop only). */
export function CursorGlow() {
  const x = useSpring(-400, { stiffness: 140, damping: 20 });
  const y = useSpring(-400, { stiffness: 140, damping: 20 });
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const move = (e: MouseEvent) => { x.set(e.clientX - 200); y.set(e.clientY - 200); };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [x, y, reduce]);
  return <motion.div aria-hidden style={{ x, y }} className="pointer-events-none fixed left-0 top-0 z-0 hidden h-[400px] w-[400px] rounded-full bg-emerald-200/30 blur-3xl md:block" />;
}
