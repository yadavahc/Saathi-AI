"use client";
import clsx from "clsx";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Camera, Check, PlayCircle, ShieldAlert, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { MagneticButton, SplitWords } from "./ui";

const ClayScene = dynamic(() => import("./ClayScene"), { ssr: false, loading: () => null });
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 16 });
  const sy = useSpring(my, { stiffness: 60, damping: 16 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const useChip = (depth: number) => ({ x: useTransform(sx, [-1, 1], [-depth, depth]), y: useTransform(sy, [-1, 1], [-depth, depth]) });
  const c1 = useChip(26), c2 = useChip(40), c3 = useChip(18), c4 = useChip(34);

  return (
    <section ref={ref} id="top" className="relative min-h-[100svh] overflow-hidden pt-28 md:pt-32"
      onMouseMove={(e) => {
        if (reduce) return;
        mx.set((e.clientX / window.innerWidth) * 2 - 1);
        my.set((e.clientY / window.innerHeight) * 2 - 1);
      }}>
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-[1.1fr_1fr]">
        <motion.div style={{ y: textY, opacity: fade }} className="relative z-10">
          <motion.a href="#demo" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="clay-sm mb-7 inline-flex items-center gap-2 !rounded-full py-1.5 pl-1.5 pr-4 text-[13px] font-medium text-slate-600 transition hover:text-slate-900">
            <span className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-0.5 text-[11px] font-bold text-white">NEW</span>
            Watch the 1-minute demo <ArrowRight size={14} />
          </motion.a>
          <h1 className="font-display text-[44px] font-bold leading-[1.02] tracking-[-0.035em] text-slate-900 sm:text-6xl lg:text-[74px]">
            <SplitWords text="Don't just tell me what happened." />
            <br />
            <SplitWords text="Help me fix it." delay={0.45} highlight={["fix", "it"]} />
          </h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05, duration: 0.8 }}
            className="mt-6 max-w-xl text-[18px] font-medium text-slate-500 md:text-xl">
            Your money &amp; business agent — in Kannada, Hindi or English.
          </motion.p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {[["Understands", "bg-sky-100 text-sky-700"], ["Asks", "bg-amber-100 text-amber-700"], ["Acts", "bg-violet-100 text-violet-700"], ["Verifies", "bg-emerald-100 text-emerald-700"]].map(([w, c], i) => (
              <motion.span key={w} initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 1.2 + i * 0.18, type: "spring", stiffness: 260, damping: 16 }}
                className="flex items-center gap-2">
                <span className={clsx("rounded-full px-3.5 py-1.5 text-[14px] font-bold shadow-[inset_0_-3px_6px_rgba(15,23,42,.06),inset_0_2px_4px_rgba(255,255,255,.7)]", c)}>{w}</span>
                {i < 3 && <ArrowRight size={15} className="text-slate-300" />}
              </motion.span>
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.8 }} className="mt-9 flex flex-wrap items-center gap-3">
            <MagneticButton href="/console"><PlayCircle size={18} /> Watch the live demo</MagneticButton>
            <MagneticButton href="/app" variant="ghost">Try the app <ArrowRight size={16} /></MagneticButton>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="mt-10 flex flex-wrap items-center gap-2">
            {["Claude", "Sarvam AI", "Vobiz", "Telegram", "Google Sheets"].map((t) => (
              <span key={t} className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[12.5px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
                <Sparkles size={12} className="text-emerald-500" />{t}
              </span>
            ))}
          </motion.div>
        </motion.div>

        <motion.div style={{ y: phoneY }} className="relative [perspective:1200px]">
          <div className="pointer-events-none absolute inset-[-10%_-16%_-8%_-4%]">{!reduce && <ClayScene />}</div>
          <div id="guide-home" className="relative z-10 mx-auto h-[540px] w-full max-w-[420px]">
            <div className="absolute inset-x-10 bottom-0 h-14 rounded-[50%] bg-gradient-to-b from-emerald-100 to-emerald-200/60 shadow-[inset_0_-6px_12px_rgba(16,185,129,.18),0_18px_30px_-18px_rgba(16,185,129,.6)]" />
          </div>
          <FloatChip style={c1} className="-left-2 top-12 md:-left-10" delay={1.2}><ShieldAlert size={15} className="text-rose-500" /> Risk <b className="text-slate-900">91/100</b> · blocked</FloatChip>
          <FloatChip style={c2} className="-right-2 top-44 md:-right-24 lg:-right-16" delay={1.45}><Camera size={15} className="text-sky-500" /> <b className="text-slate-900">₹200</b> overcharge caught</FloatChip>
          <FloatChip style={c3} className="-left-4 bottom-36 md:-left-14" delay={1.7}><span className="font-semibold text-emerald-600">87% → 8%</span> payment risk</FloatChip>
          <FloatChip style={c4} className="-right-4 bottom-16 md:-right-12" delay={1.95}><Check size={15} className="text-emerald-500" /> Verified · audit logged</FloatChip>
        </motion.div>
      </div>
      <motion.div style={{ opacity: fade }} className="mt-14 flex justify-center pb-8">
        <a href="#demo" className="group flex flex-col items-center gap-2 text-[12px] font-medium text-slate-400">
          Scroll
          <span className="grid h-9 w-5 justify-center rounded-full border-2 border-slate-300 pt-1.5">
            <motion.span animate={{ y: [0, 10, 0], opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1.8 }} className="h-1.5 w-1 rounded-full bg-slate-500" />
          </span>
        </a>
      </motion.div>
    </section>
  );
}

function FloatChip({ children, className, style, delay }: { children: React.ReactNode; className?: string; style: any; delay: number }) {
  return (
    <motion.div style={style} className={clsx("absolute z-20 hidden sm:block", className)}>
      <motion.div initial={{ opacity: 0, scale: 0.6, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay, type: "spring", stiffness: 160, damping: 14 }}>
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 4 + delay, ease: "easeInOut" }}
          className="clay-sm flex items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-[12.5px] font-medium text-slate-600">
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
