"use client";
import clsx from "clsx";
import { AnimatePresence, motion, useInView, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Camera, PlayCircle, RotateCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Counter, Eyebrow, MagneticButton, Reveal, SplitWords } from "./ui";

// ── Scam Shield: a call that plays out on screen ─────────────────────────────
const CALL = [
  { who: "Caller", text: "Main Mumbai Cyber Crime branch se Inspector Sharma bol raha hoon.", flag: "Pretends to be police", risk: 22 },
  { who: "Rahul", text: "Haan ji, boliye?" },
  { who: "Caller", text: "Aapke Aadhaar se ek parcel mein drugs mile hain.", flag: "Fake parcel / drugs story", risk: 37 },
  { who: "Caller", text: "Aapko digital arrest kiya ja raha hai. Kisi ko mat bataiye.", flag: "Threatens 'digital arrest'", risk: 80 },
  { who: "Caller", text: "Paisa RBI safe account mein transfer kijiye aur OTP bataiye.", flag: "OTP + 'safe account' transfer", risk: 98 },
];

function ShieldDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-120px" });
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!inView) return;
    setStep(0);
    const timers = CALL.map((_, i) => setTimeout(() => setStep(i + 1), 900 + i * 1500));
    return () => timers.forEach(clearTimeout);
  }, [inView, run]);
  const shown = CALL.slice(0, step);
  const risk = Math.max(0, ...shown.map((c) => c.risk || 0));
  const verdict = risk >= 70 ? "SCAM" : risk >= 35 ? "SUSPICIOUS" : "LISTENING";
  const color = risk >= 70 ? "#f43f5e" : risk >= 35 ? "#f59e0b" : "#10b981";
  return (
    <div ref={ref} className={clsx("clay relative overflow-hidden p-6 transition-colors duration-700 md:p-8", verdict === "SCAM" && "clay-rose")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-rose-600"><ShieldAlert size={16} /> Scam Shield</div>
          <h3 className="font-display mt-2 text-2xl font-bold text-slate-900 md:text-3xl">Hears the scam. Warns you live.</h3>
        </div>
        <button onClick={() => setRun((r) => r + 1)} className="clay-sm shrink-0 !rounded-full p-2.5 text-slate-500 transition hover:rotate-[-90deg] hover:text-slate-900" aria-label="Replay"><RotateCcw size={16} /></button>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-[170px_1fr]">
        <div className="flex flex-row items-center gap-4 md:flex-col md:items-start">
          <div className="clay-sm relative grid h-36 w-36 place-items-center !rounded-full">
            <svg viewBox="0 0 100 100" className="absolute inset-2 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="9" />
              <motion.circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" animate={{ pathLength: risk / 100 }} transition={{ type: "spring", stiffness: 60, damping: 15 }} />
            </svg>
            <div className="text-center"><div className="text-4xl font-black tabular-nums text-slate-900">{risk}</div><div className="text-[11px] text-slate-400">risk / 100</div></div>
          </div>
          <motion.div key={verdict} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="rounded-full px-3.5 py-1 text-[12px] font-bold text-white" style={{ background: color }}>{verdict}</motion.div>
        </div>
        <div className="space-y-2">
          <AnimatePresence>
            {shown.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={clsx("flex flex-wrap items-center gap-2", c.who === "Rahul" && "justify-end")}>
                <span className={clsx("rounded-2xl px-3.5 py-2 text-[13.5px]", c.who === "Rahul" ? "bg-sky-500 text-white" : "bg-white text-slate-700 shadow-sm ring-1 ring-slate-100")}>
                  <span className="mr-1.5 text-[10px] font-bold uppercase opacity-50">{c.who}</span>{c.text}
                </span>
                {c.flag && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: "spring" }} className="rounded-full bg-rose-100 px-2.5 py-1 text-[11.5px] font-semibold text-rose-700">🚩 {c.flag}</motion.span>}
              </motion.div>
            ))}
          </AnimatePresence>
          <AnimatePresence>
            {verdict === "SCAM" && (
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.5, type: "spring" }}
                className="mt-3 rounded-2xl bg-rose-500 p-4 text-white shadow-[0_18px_40px_-14px_rgba(244,63,94,.8)]">
                <div className="font-bold">🚨 Idu scam call! Phone cut maadi.</div>
                <div className="text-[13px] text-white/90">Report 1930 · alert family · block — with your OK</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Snap & Act: scanner over the real sample photos ──────────────────────────
const DOCS = {
  bill: { label: "Supplier bill", src: "/samples/bill.png", lines: [["Sona Masoori Rice 50 KG", "₹52/kg", "agreed ₹48 → ₹200 extra", true], ["Sugar 20 KG", "₹40/kg", "matches ✓", false]],
    result: "₹200 overcharge caught · dispute sent · delivery recorded at ₹3,200" },
  khata: { label: "Khata page", src: "/samples/khata.png", lines: [["Ramesh", "₹3,500", "was ₹4,500 (₹1,000 paid)", true], ["Ravi", "₹3,200", "new customer", true], ["Kavya", "₹800", "new customer", true]],
    result: "Credit book synced · 3 changes · total ₹11,500" },
  shelf: { label: "Shelf", src: "/samples/shelf.png", lines: [["Rice", "empty", "reorder 50 KG", true], ["Tea Powder", "low", "reorder 10 KG", true], ["Sugar · Oil", "full", "no action", false]],
    result: "2 purchase orders sent to suppliers" },
} as const;

function SnapDemo() {
  const [tab, setTab] = useState<keyof typeof DOCS>("bill");
  const doc = DOCS[tab];
  return (
    <div className="clay relative overflow-hidden p-6 md:p-8">
      <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-sky-600"><Camera size={16} /> Snap & Act</div>
      <h3 className="font-display mt-2 text-2xl font-bold text-slate-900 md:text-3xl">Paper in. Actions out.</h3>
      <div className="mt-5 inline-flex rounded-full bg-slate-100 p-1 shadow-[inset_0_2px_4px_rgba(15,23,42,.06)]">
        {(Object.keys(DOCS) as (keyof typeof DOCS)[]).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={clsx("relative rounded-full px-4 py-1.5 text-[13px] font-semibold transition", tab === k ? "text-slate-900" : "text-slate-500")}>
            {tab === k && <motion.span layoutId="snapTab" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
            <span className="relative">{DOCS[k].label}</span>
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-[230px_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-slate-100 ring-4 ring-white shadow-lg">
          <AnimatePresence mode="wait">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img key={tab} src={doc.src} alt={doc.label} initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="h-64 w-full object-cover" />
          </AnimatePresence>
          <motion.div key={`scan-${tab}`} initial={{ top: "-10%" }} animate={{ top: ["-10%", "100%"] }} transition={{ duration: 1.6, ease: "easeInOut" }}
            className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-sky-400/45 to-transparent" />
          <div className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] font-bold text-sky-700 shadow">Claude vision</div>
        </div>
        <div className="space-y-2">
          {doc.lines.map(([name, value, note, flagged], i) => (
            <motion.div key={`${tab}-${i}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 + i * 0.25 }}
              className={clsx("flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1", flagged ? "bg-amber-50 ring-amber-200" : "bg-slate-50 ring-slate-100")}>
              <div><div className="text-[14px] font-semibold text-slate-900">{name}</div><div className={clsx("text-[12.5px]", flagged ? "text-amber-700" : "text-slate-500")}>{note}</div></div>
              <div className="font-mono text-[13px] font-medium text-slate-700">{value}</div>
            </motion.div>
          ))}
          <motion.div key={`r-${tab}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.1 }}
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-[14px] font-semibold text-white shadow-lg shadow-emerald-600/25">✓ {doc.result}</motion.div>
        </div>
      </div>
    </div>
  );
}

export function Wow() {
  return (
    <section id="wow" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal className="text-center">
          <Eyebrow>New</Eyebrow>
          <h2 className="font-display mx-auto mt-5 max-w-4xl text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
            <SplitWords text="It hears the scam. It reads the bill." highlight={["scam.", "bill."]} />
          </h2>
        </Reveal>
        <div className="mt-14 space-y-6">
          <Reveal><ShieldDemo /></Reveal>
          <Reveal><SnapDemo /></Reveal>
        </div>
      </div>
    </section>
  );
}

// ── numbers ───────────────────────────────────────────────────────────────────
export function Stats() {
  const stats = [
    { v: 52, label: "Backend tools", s: "", c: "clay-mint" }, { v: 6, label: "Specialist agents", s: "", c: "clay-sky" }, { v: 9, label: "Languages & mixes", s: "", c: "clay-lilac" },
    { v: 24, label: "Outcomes verified", s: "/24", c: "clay-butter" }, { v: 91, label: "Fraud risk scored live", s: "/100", c: "clay-rose" }, { v: 0, label: "Actions without OK", s: "", c: "clay-peach" },
  ];
  return (
    <section id="stats" className="relative py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 md:grid-cols-3 md:gap-5 md:px-8">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.06}>
            <div className={clsx("clay p-7 text-center transition duration-500 hover:-translate-y-1", s.c)}>
              <div className="font-display text-5xl font-bold tracking-tight text-slate-900 md:text-6xl"><Counter to={s.v} suffix={s.s} /></div>
              <div className="mt-2 text-[13.5px] font-medium text-slate-600">{s.label}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── gallery: vertical scroll drives a horizontal strip ───────────────────────
const SHOTS = [
  ["control-room-fraud.png", "Control Room · live fraud call", true], ["app-shield-scam.png", "Scam Shield · 98/100", false],
  ["action-trace.png", "Action Trace · words → verified result", true], ["app-snap-bill.png", "Snap & Act · overcharge caught", false],
  ["merchant-health.png", "Merchant Health", true], ["app-lakshmi-home.png", "Lakshmi's app", false],
  ["control-scam-shield.png", "Scam Shield · Control Room", true], ["impact.png", "Impact · every outcome verified", true],
] as const;

export function Gallery() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["2%", "-72%"]);
  return (
    <section ref={ref} id="gallery" className="relative h-[300vh]">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="mx-auto mb-10 w-full max-w-6xl px-5 md:px-8">
          <Eyebrow>Real screens</Eyebrow>
          <h2 className="font-display mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Built, running, <span className="text-gradient">verified.</span></h2>
        </div>
        <motion.div style={{ x }} className="flex items-center gap-7 pl-5 md:pl-[max(2rem,calc((100vw-72rem)/2))]">
          {SHOTS.map(([src, label, wide]) => (
            <figure key={src} className={clsx("group shrink-0", wide ? "w-[78vw] md:w-[640px]" : "w-[44vw] md:w-[250px]")}>
              <div className="clay overflow-hidden !rounded-[22px] p-2 transition duration-500 group-hover:-translate-y-2">
                <div className="overflow-hidden rounded-2xl ring-1 ring-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/landing/${src}`} alt={label} loading="lazy" className="w-full transition duration-700 group-hover:scale-[1.03]" />
                </div>
              </div>
              <figcaption className="mt-3 text-[13px] font-medium text-slate-500">{label}</figcaption>
            </figure>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── final call to action + footer ────────────────────────────────────────────
export function FinalCTA() {
  return (
    <section id="cta" className="relative overflow-hidden py-28">
      <div className="mx-auto max-w-5xl px-5">
        <Reveal>
          <div className="clay relative overflow-hidden !rounded-[40px] px-6 py-16 text-center md:px-14 md:py-20">
            <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/60 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-amber-200/60 blur-3xl" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-violet-200/40 blur-3xl" />
            <h2 className="font-display relative text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 md:text-7xl">
              Don't just tell me what happened.<br /><span className="text-gradient">Help me fix it.</span>
            </h2>
            <div className="relative mt-10 flex flex-wrap justify-center gap-3">
              <MagneticButton href="/console"><PlayCircle size={18} /> Start the live demo</MagneticButton>
              <MagneticButton href="/app" variant="ghost">Sign in as Rahul or Lakshmi <ArrowRight size={16} /></MagneticButton>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-200/70 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-[13px] text-slate-500 md:flex-row md:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-amber-400 text-[12px] font-black text-white">स</span>
          <span>SAATHI AI · Built by <span className="font-semibold text-slate-800">Yadava H C</span></span>
        </div>
        <div className="flex gap-5 font-medium">
          <Link href="/console" className="hover:text-slate-900">Control Room</Link>
          <Link href="/app" className="hover:text-slate-900">User app</Link>
          <a href="https://github.com/yadavahc/Saathi-AI" target="_blank" rel="noreferrer" className="hover:text-slate-900">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
