"use client";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, PlayCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { MagneticButton } from "./ui";

const ClayScene = dynamic(() => import("./ClayScene"), { ssr: false, loading: () => null });
const WORD = "SAATHI";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, 120]);

  return (
    <section ref={ref} id="top" className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-5 pb-20 pt-28">
      <motion.div style={{ y: sceneY }} className="pointer-events-none absolute inset-0">{!reduce && <ClayScene wide />}</motion.div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[820px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(167,243,208,.55),rgba(253,230,138,.25),transparent)] blur-2xl" />

      <motion.div style={{ y: textY, opacity: fade }} className="relative z-10 mx-auto max-w-4xl text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-[13px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> AI agent for money &amp; business
        </motion.div>

        <h1 className="font-display mt-7 flex items-baseline justify-center gap-[0.18em] text-[76px] font-bold leading-none tracking-[-0.05em] text-slate-900 sm:text-[120px] lg:text-[156px]">
          <span className="flex">
            {WORD.split("").map((c, i) => (
              <motion.span key={i} className="inline-block" initial={reduce ? false : { y: "60%", opacity: 0, rotate: -8 }} animate={{ y: "0%", opacity: 1, rotate: 0 }}
                transition={{ delay: 0.15 + i * 0.07, type: "spring", stiffness: 260, damping: 18 }}>{c}</motion.span>
            ))}
          </span>
          <motion.span className="text-gradient" initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.75, type: "spring", stiffness: 220, damping: 14 }}>AI</motion.span>
        </h1>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.7 }}
          className="font-display mx-auto mt-6 max-w-2xl text-[24px] font-semibold leading-snug tracking-tight text-slate-800 md:text-[32px]">
          Don't just tell me what happened.<br /><span className="text-gradient">Help me fix it.</span>
        </motion.p>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.7 }}
          className="mx-auto mt-4 max-w-xl text-[16px] text-slate-500 md:text-[18px]">
          Speak in Kannada, Hindi or English. SAATHI understands, acts — and verifies.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.7 }} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <MagneticButton href="#demo"><PlayCircle size={18} /> Watch the demo</MagneticButton>
          <MagneticButton href="/app" variant="ghost">Try the app <ArrowRight size={16} /></MagneticButton>
        </motion.div>
      </motion.div>

      <motion.a href="#demo" style={{ opacity: fade }} className="absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[12px] font-medium text-slate-400">
        Scroll
        <span className="grid h-9 w-5 justify-center rounded-full border-2 border-slate-300 pt-1.5">
          <motion.span animate={{ y: [0, 10, 0], opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1.8 }} className="h-1.5 w-1 rounded-full bg-slate-500" />
        </span>
      </motion.a>
    </section>
  );
}
