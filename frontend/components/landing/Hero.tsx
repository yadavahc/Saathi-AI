"use client";
import clsx from "clsx";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Camera, Check, Mic, PlayCircle, ShieldAlert, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { MagneticButton, SplitWords } from "./ui";

const ClayScene = dynamic(() => import("./ClayScene"), { ssr: false, loading: () => null });
const SCENES = ["business", "scam", "snap"] as const;

function PhoneScene({ scene }: { scene: (typeof SCENES)[number] }) {
  if (scene === "business") {
    return (
      <div className="space-y-2.5">
        <Bubble side="right" delay={0.1}><Mic size={12} className="mr-1 inline" />Aaj business hegide?</Bubble>
        <Bubble side="left" delay={0.7}>Sales <b className="text-emerald-600">+29.6%</b> today. But evening sales are <b className="text-rose-600">−31%</b> and rice stock is critical.</Bubble>
        <motion.div initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 1.4, type: "spring", stiffness: 200, damping: 18 }}
          className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Needs your OK</div>
          <div className="mt-1 text-[13px] font-semibold text-slate-900">Order 50 KG rice · ₹2,400</div>
          <motion.div initial={{ backgroundColor: "#a7f3d0" }} animate={{ backgroundColor: ["#a7f3d0", "#10b981", "#10b981"] }}
            transition={{ delay: 2.3, duration: 0.6 }} className="mt-2 rounded-xl py-1.5 text-center text-[12px] font-bold text-white">
            Approve
          </motion.div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 3, type: "spring" }}
          className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
          <Check size={14} /> Supplier accepted · ORDER CONFIRMED
        </motion.div>
      </div>
    );
  }
  if (scene === "scam") {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="relative grid h-16 w-16 place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90 text-rose-500">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="10" />
              <motion.circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 0.98 }} transition={{ duration: 2.4, ease: "easeOut" }} />
            </svg>
            <span className="text-[17px] font-black text-slate-900">98</span>
          </div>
          <div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="rounded-full bg-rose-500 px-2.5 py-0.5 text-[11px] font-bold text-white">SCAM CALL</motion.div>
            <div className="mt-1 text-[12px] text-slate-500">“Mumbai Cyber Crime”</div>
          </div>
        </div>
        {["Threatens 'digital arrest'", "Asks for OTP", "Money to 'safe account'"].map((f, i) => (
          <motion.div key={f} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.45 }}
            className="rounded-full bg-rose-50 px-3 py-1 text-[11.5px] font-medium text-rose-700">🚩 {f}</motion.div>
        ))}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2, type: "spring" }}
          className="rounded-2xl bg-rose-500 p-3 text-[12.5px] font-semibold leading-snug text-white shadow-lg shadow-rose-500/30">
          🚨 Idu scam call! Phone cut maadi. Police yavaagloo OTP keLalla.
        </motion.div>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#fbfaf6] p-3 font-mono text-[10px] text-stone-700">
        <div className="text-center text-[11px] font-bold text-stone-900">ABC STORES (WHOLESALE)</div>
        <div className="mt-2 flex justify-between"><span>Rice 50 KG</span><span>@52 = 2,600</span></div>
        <div className="flex justify-between"><span>Sugar 20 KG</span><span>@40 = 800</span></div>
        <div className="mt-1 flex justify-between border-t border-stone-300 pt-1 font-bold"><span>TOTAL</span><span>₹3,400</span></div>
        <motion.div initial={{ top: "0%" }} animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 1.8, ease: "easeInOut" }}
          className="absolute inset-x-0 h-8 -translate-y-1/2 bg-gradient-to-b from-transparent via-sky-400/40 to-transparent" />
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.9, type: "spring" }}
        className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">
        <div className="font-bold">⚠ ₹52/kg vs agreed ₹48</div>
        <div className="text-[11.5px] text-rose-600/80">₹200 overcharge caught</div>
      </motion.div>
      <Bubble side="left" delay={2.6}>Supplier-ge message kalisla? Fair amount <b className="text-emerald-600">₹3,200</b>.</Bubble>
    </div>
  );
}

function Bubble({ side, delay, children }: { side: "left" | "right"; delay: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, type: "spring", stiffness: 220, damping: 20 }}
      className={clsx("max-w-[88%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug", side === "right" ? "ml-auto rounded-br-md bg-sky-500 text-white" : "rounded-bl-md bg-slate-100 text-slate-700")}>
      {children}
    </motion.div>
  );
}

function Phone() {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SCENES.length), 5200);
    return () => clearInterval(t);
  }, []);
  const scene = SCENES[i];
  const titles = { business: "Merchant · Kannada voice", scam: "Scam Shield · live call", snap: "Snap & Act · bill photo" };
  return (
    <div className="clay relative mx-auto w-[296px] !rounded-[46px] p-3">
      <div className="relative h-[552px] overflow-hidden rounded-[36px] bg-white ring-1 ring-slate-100">
        <div className="absolute left-1/2 top-2.5 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
        <div className="flex items-center justify-between px-5 pb-3 pt-12">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-amber-400 text-[13px] font-black text-white">स</div>
            <div>
              <div className="text-[13px] font-bold text-slate-900">SAATHI</div>
              <AnimatePresence mode="wait">
                <motion.div key={scene} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-[10.5px] font-medium text-emerald-600">{titles[scene]}</motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className="flex gap-1">{SCENES.map((s, k) => <span key={s} className={clsx("h-1.5 rounded-full transition-all duration-500", k === i ? "w-5 bg-emerald-500" : "w-1.5 bg-slate-200")} />)}</div>
        </div>
        <div className="px-4">
          <AnimatePresence mode="wait">
            <motion.div key={scene} initial={reduce ? false : { opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
              <PhoneScene scene={scene} />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="absolute inset-x-4 bottom-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-100">
          <span className="relative grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" /><Mic size={16} className="relative" />
          </span>
          <span className="text-[12px] text-slate-500">Tap and speak — any language</span>
        </div>
      </div>
    </div>
  );
}

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
  const rotY = useTransform(sx, [-1, 1], [-9, 9]);
  const rotX = useTransform(sy, [-1, 1], [7, -7]);
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
          <motion.div style={{ rotateY: rotY, rotateX: rotX }} initial={{ opacity: 0, y: 60, rotateZ: -4 }} animate={{ opacity: 1, y: 0, rotateZ: 0 }}
            transition={{ delay: 0.3, duration: 1.1, ease: [0.22, 1, 0.36, 1] }} className="relative z-10">
            <Phone />
          </motion.div>
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
