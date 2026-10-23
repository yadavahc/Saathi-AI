"use client";
import clsx from "clsx";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  BadgeCheck, Bell, Brain, Database, Gavel, Menu, MessageSquareQuote, Radar, ScrollText, ShieldCheck, Store, TrendingUp, Wrench, X, Zap,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Eyebrow, Reveal, SplitWords } from "./ui";

// ── navigation ────────────────────────────────────────────────────────────────
const LINKS = [["Demo", "#demo"], ["Problem", "#gap"], ["How it works", "#loop"], ["Features", "#features"], ["Wow", "#wow"], ["Trust", "#trust"]];

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 30));
  return (
    <motion.header initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7 }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
      <nav className={clsx("flex w-full max-w-6xl items-center justify-between rounded-2xl border px-4 transition-all duration-500",
        scrolled ? "border-white/80 bg-white/80 py-2.5 shadow-[0_12px_40px_-16px_rgba(15,23,42,.25)] backdrop-blur-xl" : "border-transparent bg-transparent py-4")}>
        <a href="#top" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-amber-400 text-[16px] font-black text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,.7),inset_0_-3px_6px_rgba(0,0,0,.12),inset_0_2px_4px_rgba(255,255,255,.5)]">स</span>
          <span className="font-display text-[17px] font-bold tracking-tight text-slate-900">SAATHI <span className="text-emerald-600">AI</span></span>
        </a>
        <div className="hidden items-center gap-0.5 md:flex">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} className="group relative rounded-full px-3.5 py-2 text-[14px] font-medium text-slate-500 transition hover:text-slate-900">
              <span className="absolute inset-0 scale-75 rounded-full bg-slate-900/[0.05] opacity-0 transition duration-300 group-hover:scale-100 group-hover:opacity-100" />
              <span className="relative">{label}</span>
            </a>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/app" className="rounded-full px-4 py-2 text-[14px] font-semibold text-slate-600 transition hover:text-slate-900">User app</Link>
          <Link href="/console" className="rounded-full bg-slate-900 px-4 py-2 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(15,23,42,.6)] transition hover:bg-emerald-600">Open Control Room</Link>
        </div>
        <button className="text-slate-800 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </nav>
      {open && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="clay absolute inset-x-3 top-[72px] p-4 md:hidden">
          {LINKS.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)} className="block py-2.5 font-medium text-slate-700">{label}</a>)}
          <div className="mt-3 flex gap-2">
            <Link href="/app" className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center font-medium text-slate-800">User app</Link>
            <Link href="/console" className="flex-1 rounded-xl bg-slate-900 py-2.5 text-center font-semibold text-white">Control Room</Link>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}

// ── marquees ──────────────────────────────────────────────────────────────────
export function Marquee({ items, reverse = false, className }: { items: string[]; reverse?: boolean; className?: string }) {
  return (
    <div className={clsx("marquee-mask relative flex overflow-hidden", className)}>
      {[0, 1].map((k) => (
        <div key={k} aria-hidden={k === 1} className={clsx("flex shrink-0 items-center gap-10 pr-10", reverse ? "animate-marquee-rev" : "animate-marquee")}>
          {items.map((t, i) => <span key={`${k}-${i}`} className="whitespace-nowrap">{t}</span>)}
        </div>
      ))}
    </div>
  );
}

export function LanguageBand() {
  return (
    <section className="relative py-8">
      <div className="mx-auto max-w-[1400px] px-3">
        <div className="clay overflow-hidden !rounded-[32px] py-7">
          <Marquee className="font-display text-2xl font-semibold text-slate-800 md:text-3xl"
            items={["ನಮಸ್ಕಾರ", "•", "नमस्ते", "•", "வணக்கம்", "•", "నమస్కారం", "•", "नमस्कार", "•", "নমস্কার", "•", "Hello", "•", "Aaj business hegide?", "•", "Paisa transfer mat karo", "•"]} />
          <Marquee reverse className="mt-4 text-[13px] font-bold uppercase tracking-[0.25em] text-emerald-600/80"
            items={["Claude reasoning", "✦", "Sarvam voice", "✦", "Vobiz calls", "✦", "Telegram actions", "✦", "Google Sheets", "✦", "52 tools", "✦", "6 agents", "✦", "Approval engine", "✦", "Audit trail", "✦"]} />
        </div>
      </div>
    </section>
  );
}

// ── the action gap (sticky, scroll-driven) ────────────────────────────────────
const SAATHI_STEPS = ["Understand", "Analyze", "Reason", "Recommend", "Ask approval", "Act", "Verify", "Inform", "Audit"];

export function ActionGap() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(-1);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.floor(v * (SAATHI_STEPS.length + 1)) - 1));
  const leftOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0.5]);
  const leftScale = useTransform(scrollYProgress, [0, 0.35], [1, 0.95]);
  const bar = useSpring(scrollYProgress, { stiffness: 100, damping: 22 });
  return (
    <section id="gap" ref={ref} className="relative h-[260vh]">
      <div className="sticky top-0 flex min-h-screen items-center pb-10 pt-24">
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
          <div className="text-center">
            <Eyebrow>The problem</Eyebrow>
            <h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-[52px] md:leading-[1.05]">
              People don't lack data.<br /><span className="text-gradient">They lack action.</span>
            </h2>
          </div>
          <div className="mt-10 grid items-stretch gap-6 md:grid-cols-2">
            <motion.div style={{ opacity: leftOpacity, scale: leftScale }} className="clay p-7">
              <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-slate-400">Every other app</div>
              <div className="mt-6 space-y-3.5">
                {["Data", "Alert", "You figure it out", "You act alone"].map((t, i) => (
                  <div key={t} className="flex items-center gap-4">
                    <span className={clsx("grid h-10 w-10 place-items-center rounded-xl text-[13px] font-bold", i < 2 ? "bg-slate-100 text-slate-500" : "bg-rose-100 text-rose-600")}>{i + 1}</span>
                    <div className="font-semibold text-slate-800">{t}</div>
                  </div>
                ))}
              </div>
              <div className="mt-7 rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-700">
                ⟶ The <b>Action Gap</b>
              </div>
            </motion.div>
            <div className="clay clay-mint relative overflow-hidden p-7">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-emerald-700">SAATHI</div>
                <div className="h-2 w-28 overflow-hidden rounded-full bg-white/80"><motion.div style={{ scaleX: bar }} className="h-full origin-left bg-gradient-to-r from-emerald-500 to-amber-400" /></div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2.5">
                {SAATHI_STEPS.map((s, i) => {
                  const on = i <= active;
                  return (
                    <motion.div key={s} animate={{ scale: i === active ? 1.07 : 1, y: i === active ? -3 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}
                      className={clsx("relative rounded-2xl px-3 py-4 text-center transition-all duration-500",
                        on ? "bg-white text-slate-900 shadow-[0_10px_24px_-10px_rgba(16,185,129,.6),inset_0_-3px_6px_rgba(16,185,129,.12)]" : "bg-white/40 text-slate-400")}>
                      <div className={clsx("text-[11px] font-bold", on ? "text-emerald-600" : "text-slate-300")}>{on ? "✓ " : ""}{String(i + 1).padStart(2, "0")}</div>
                      <div className="mt-1 text-[13.5px] font-semibold">{s}</div>
                    </motion.div>
                  );
                })}
              </div>
              <motion.div animate={{ opacity: active >= SAATHI_STEPS.length - 1 ? 1 : 0, y: active >= SAATHI_STEPS.length - 1 ? 0 : 10 }}
                className="mt-6 rounded-2xl bg-emerald-600 px-4 py-3 text-[14px] font-medium text-white shadow-lg shadow-emerald-600/25">
                ✓ Evening sales <b>+42.7%</b>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── the loop (SVG path that draws on scroll) ─────────────────────────────────
const LOOP = [
  { icon: MessageSquareQuote, t: "You said", d: "“Rice stock check maadi”", tone: "bg-sky-100 text-sky-600" },
  { icon: Brain, t: "Understood", d: "inventory_check · Kanglish", tone: "bg-violet-100 text-violet-600" },
  { icon: Database, t: "Data found", d: "8 KG left · min 25 · 1.3 days", tone: "bg-emerald-100 text-emerald-600" },
  { icon: Zap, t: "Decided", d: "Reorder 50 KG (shortfall + lead time)", tone: "bg-amber-100 text-amber-600" },
  { icon: Gavel, t: "Approval", d: "Lakshmi: “Howdu, order maadi”", tone: "bg-orange-100 text-orange-600" },
  { icon: Wrench, t: "Tool used", d: "create_purchase_order()", tone: "bg-slate-100 text-slate-600" },
  { icon: Bell, t: "Action", d: "PO on Telegram → supplier taps ACCEPT", tone: "bg-sky-100 text-sky-600" },
  { icon: BadgeCheck, t: "Verified", d: "Orders[PO-3051] = CONFIRMED", tone: "bg-emerald-100 text-emerald-600" },
];

export function Loop() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const draw = useSpring(scrollYProgress, { stiffness: 80, damping: 20 });
  return (
    <section id="loop" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal className="text-center">
          <Eyebrow>How SAATHI thinks</Eyebrow>
          <h2 className="font-display mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
            <SplitWords text="From your words to a verified result." highlight={["verified", "result."]} />
          </h2>
        </Reveal>
        <div ref={ref} className="relative mt-16">
          <svg className="absolute left-[27px] top-0 h-full w-4 md:left-1/2 md:-ml-2" preserveAspectRatio="none" viewBox="0 0 4 100">
            <line x1="2" y1="0" x2="2" y2="100" stroke="#e2e8f0" strokeWidth="3" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
            <motion.line x1="2" y1="0" x2="2" y2="100" stroke="url(#loopGrad)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength: draw }} />
            <defs><linearGradient id="loopGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100"><stop offset="0" stopColor="#10b981" /><stop offset="1" stopColor="#f59e0b" /></linearGradient></defs>
          </svg>
          <div className="space-y-8 md:space-y-4">
            {LOOP.map((s, i) => (
              <LoopRow key={s.t} index={i} {...s} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LoopRow({ icon: Icon, t, d, index, tone }: { icon: any; t: string; d: string; index: number; tone: string }) {
  const left = index % 2 === 0;
  const reduce = useReducedMotion();
  return (
    <div className={clsx("relative flex items-center md:w-1/2", left ? "md:pr-14" : "md:ml-auto md:pl-14")}>
      <motion.div initial={{ scale: 0, rotate: -20 }} whileInView={{ scale: 1, rotate: 0 }} viewport={{ once: true, margin: "-120px" }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className={clsx("clay-sm absolute z-10 grid h-14 w-14 place-items-center !rounded-2xl", "left-0", left ? "md:left-auto md:-right-7" : "md:-left-7")}>
        <span className={clsx("grid h-10 w-10 place-items-center rounded-xl", tone)}><Icon size={20} /></span>
      </motion.div>
      <motion.div initial={reduce ? false : { opacity: 0, x: left ? -50 : 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-120px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={clsx("clay ml-20 w-full p-5 md:ml-0", left && "md:text-right")}>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">{String(index + 1).padStart(2, "0")} · {t}</div>
        <div className="mt-1.5 text-[16px] font-semibold text-slate-800">{d}</div>
      </motion.div>
    </div>
  );
}

// ── trust & safety ────────────────────────────────────────────────────────────
export function Trust() {
  const items = [
    { icon: ShieldCheck, t: "Never asks for OTP or PIN", c: "clay-mint", i: "text-emerald-600" },
    { icon: Gavel, t: "Nothing moves without your OK", c: "clay-butter", i: "text-amber-600" },
    { icon: BadgeCheck, t: "Verified, not assumed", c: "clay-sky", i: "text-sky-600" },
    { icon: ScrollText, t: "Every step on the record", c: "clay-lilac", i: "text-violet-600" },
    { icon: Brain, t: "AI reasons, code calculates", c: "clay-peach", i: "text-orange-600" },
    { icon: Radar, t: "Works even when services fail", c: "clay-rose", i: "text-rose-600" },
  ];
  return (
    <section id="trust" className="relative py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal className="text-center">
          <Eyebrow>Trust by design</Eyebrow>
          <h2 className="font-display mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">An agent you can <span className="text-gradient">actually trust</span> with money.</h2>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.t} delay={i * 0.07}>
              <div className={clsx("clay", it.c, "group flex h-full items-center gap-4 p-5 transition duration-500 hover:-translate-y-1.5")}>
                <span className={clsx("grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white shadow-[0_8px_16px_-8px_rgba(15,23,42,.25),inset_0_-3px_6px_rgba(15,23,42,.06)] transition duration-500 group-hover:rotate-[-8deg] group-hover:scale-110", it.i)}><it.icon size={24} /></span>
                <div className="text-[17px] font-bold leading-snug text-slate-900">{it.t}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export const AGENT_CHIPS = [
  { icon: ShieldCheck, label: "Financial Safety" }, { icon: Bell, label: "Money SOS" }, { icon: Store, label: "Merchant Ops" },
  { icon: TrendingUp, label: "Merchant Growth" }, { icon: Radar, label: "Payment Reliability" }, { icon: Wrench, label: "Commerce" },
];
