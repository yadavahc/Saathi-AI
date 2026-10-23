"use client";
import clsx from "clsx";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";

/** Fades + lifts children into view once. */
export function Reveal({ children, delay = 0, y = 28, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/** Word-by-word headline reveal. */
export function SplitWords({ text, className, delay = 0, highlight }: { text: string; className?: string; delay?: number; highlight?: string[] }) {
  const reduce = useReducedMotion();
  return (
    <span className={className}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span className={clsx("inline-block", highlight?.includes(w.replace(/[.,]/g, "")) && "text-gradient")}
            initial={reduce ? false : { y: "110%", rotate: 4 }} whileInView={{ y: "0%", rotate: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.9, delay: delay + i * 0.06, ease: [0.22, 1, 0.36, 1] }}>
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Card whose border + background glow follows the cursor, with a gentle 3D tilt. */
export function SpotlightCard({ children, className, tilt = true }: { children: ReactNode; className?: string; tilt?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 180, damping: 18 });
  const ry = useSpring(0, { stiffness: 180, damping: 18 });

  function move(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
    if (tilt && !reduce) {
      rx.set(((y / r.height) - 0.5) * -7);
      ry.set(((x / r.width) - 0.5) * 7);
    }
  }
  function leave() { rx.set(0); ry.set(0); }

  return (
    <motion.div ref={ref} onMouseMove={move} onMouseLeave={leave} style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={clsx("spotlight-card clay group relative overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(380px circle at var(--mx) var(--my), rgba(16,185,129,.10), transparent 50%)" }} />
      <div className="relative h-full">{children}</div>
    </motion.div>
  );
}

/** Button that is gently pulled toward the cursor. */
export function MagneticButton({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: "primary" | "ghost"; className?: string }) {
  const x = useSpring(0, { stiffness: 220, damping: 14 });
  const y = useSpring(0, { stiffness: 220, damping: 14 });
  const reduce = useReducedMotion();
  return (
    <motion.div style={{ x, y }} className="inline-block"
      onMouseMove={(e) => {
        if (reduce) return;
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.28);
        y.set((e.clientY - r.top - r.height / 2) * 0.35);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}>
      <Link href={href} className={clsx(
        "group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-7 py-3.5 text-[15px] font-semibold transition-colors",
        variant === "primary" ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_18px_36px_-12px_rgba(16,185,129,.65),inset_0_-4px_8px_rgba(0,0,0,.12),inset_0_3px_6px_rgba(255,255,255,.35)]"
          : "clay-sm text-slate-800 hover:text-slate-900", className)}>
        {variant === "primary" && <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />}
        <span className="relative flex items-center gap-2">{children}</span>
      </Link>
    </motion.div>
  );
}

/** Counts up when scrolled into view. */
export function Counter({ to, prefix = "", suffix = "", decimals = 0, duration = 1.8 }: { to: number; prefix?: string; suffix?: string; decimals?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setValue });
    return () => controls.stop();
  }, [inView, to, duration]);
  return <span ref={ref} className="tabular-nums">{prefix}{value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/** Section label pill. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-emerald-700 shadow-[0_8px_18px_-10px_rgba(16,185,129,.5),inset_0_-3px_6px_rgba(15,23,42,.04)]">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />{children}
    </div>
  );
}

/** Parallax helper: maps a 0..1 motion value to a translate range. */
export function useParallax(value: ReturnType<typeof useMotionValue<number>>, distance: number) {
  return useTransform(value, [0, 1], [-distance, distance]);
}
