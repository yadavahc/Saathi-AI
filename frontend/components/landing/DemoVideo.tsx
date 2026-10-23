"use client";
import clsx from "clsx";
import { AudioWaveform, Captions, Check, FileSpreadsheet, Pause, PhoneCall, Play, RotateCcw, ScrollText, Send, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Eyebrow, Reveal, SplitWords } from "./ui";

/*
 * A cartoon "product video" of the whole SAATHI workflow. Everything on the stage is a
 * pure function of the playhead `t` (seconds), so play / pause / scrub are exact.
 * The stage is authored at 1280×720 and scaled to fit, like a real video frame.
 */

const W = 1280;
const H = 720;
const TOTAL = 63;

type NodeId = "rahul" | "lakshmi" | "vobiz" | "sarvam" | "saathi" | "claude" | "telegram" | "sheets" | "supplier" | "audit";

const POS: Record<NodeId, [number, number]> = {
  rahul: [110, 170], lakshmi: [110, 480], vobiz: [390, 120], sarvam: [390, 330], claude: [640, 92],
  saathi: [640, 292], telegram: [900, 150], sheets: [915, 468], supplier: [1170, 290], audit: [640, 532],
};

const APPEAR: Record<NodeId, number> = {
  rahul: 0.3, lakshmi: 0.8, saathi: 1.4, claude: 2.2, sarvam: 2.6, vobiz: 3.0, telegram: 3.4, sheets: 3.8, supplier: 4.2, audit: 4.6,
};

const EDGES: { a: NodeId; b: NodeId; k: number }[] = [
  { a: "rahul", b: "vobiz", k: -0.15 }, { a: "vobiz", b: "sarvam", k: 0.22 }, { a: "lakshmi", b: "sarvam", k: 0.12 },
  { a: "sarvam", b: "saathi", k: -0.1 }, { a: "rahul", b: "saathi", k: 0.08 }, { a: "lakshmi", b: "saathi", k: -0.1 },
  { a: "saathi", b: "claude", k: 0.18 }, { a: "saathi", b: "telegram", k: -0.12 }, { a: "telegram", b: "supplier", k: -0.12 },
  { a: "saathi", b: "sheets", k: 0.12 }, { a: "saathi", b: "audit", k: -0.18 },
];

/** Voiceover: one pre-rendered clip per chapter (Sarvam Bulbul v3, male Indian-English voice “shubh”). */
const VO_LEAD = 0.25;
const VO_SRC = (i: number) => `/demo/vo-${i}.mp3`;

const C = { voice: "#8b5cf6", claude: "#e07a4f", tg: "#229ed9", data: "#10b981", alert: "#f43f5e", app: "#0ea5e9" };

type Packet = { a: NodeId; b: NodeId; t0: number; d: number; c: string; label?: string };
function chain(path: NodeId[], t0: number, per: number, c: string, label?: string): Packet[] {
  return path.slice(1).map((b, i) => ({ a: path[i], b, t0: t0 + i * per, d: per, c, label }));
}

const PACKETS: Packet[] = [
  { a: "saathi", b: "audit", t0: 10.2, d: 0.8, c: C.alert, label: "logged" },
  ...chain(["saathi", "sarvam", "vobiz", "rahul"], 13.4, 0.9, C.voice, "voice"),
  ...chain(["rahul", "vobiz", "sarvam", "saathi"], 19.3, 0.55, C.voice, "“No”"),
  { a: "saathi", b: "claude", t0: 21.3, d: 0.9, c: C.claude, label: "reason" },
  { a: "claude", b: "saathi", t0: 24.0, d: 0.9, c: C.claude, label: "plan" },
  { a: "saathi", b: "audit", t0: 26.4, d: 0.8, c: C.data },
  { a: "saathi", b: "rahul", t0: 28.0, d: 0.7, c: C.app, label: "approve?" },
  { a: "rahul", b: "saathi", t0: 30.7, d: 0.8, c: C.data, label: "yes" },
  { a: "saathi", b: "telegram", t0: 31.6, d: 1.0, c: C.tg, label: "✈" },
  { a: "saathi", b: "audit", t0: 32.8, d: 0.8, c: C.data },
  ...chain(["lakshmi", "sarvam", "saathi"], 35.7, 0.8, C.voice, "voice"),
  { a: "saathi", b: "sheets", t0: 37.4, d: 0.9, c: C.data, label: "read" },
  { a: "sheets", b: "saathi", t0: 38.9, d: 0.8, c: C.data, label: "rows" },
  ...chain(["saathi", "sarvam", "lakshmi"], 39.8, 0.7, C.voice, "voice"),
  { a: "lakshmi", b: "saathi", t0: 43.6, d: 0.8, c: C.data, label: "yes" },
  ...chain(["saathi", "telegram", "supplier"], 44.5, 0.85, C.tg, "PO"),
  ...chain(["supplier", "telegram", "saathi"], 47.6, 0.7, C.tg, "ACCEPT"),
  { a: "saathi", b: "sheets", t0: 49.0, d: 0.8, c: C.data, label: "write" },
  { a: "lakshmi", b: "saathi", t0: 51.5, d: 0.9, c: C.app, label: "🧾" },
  { a: "saathi", b: "claude", t0: 52.4, d: 0.8, c: C.claude, label: "vision" },
  { a: "claude", b: "saathi", t0: 54.4, d: 0.7, c: C.claude },
  ...chain(["saathi", "telegram", "supplier"], 55.6, 0.7, C.tg, "dispute"),
  { a: "saathi", b: "audit", t0: 57.2, d: 0.7, c: C.data },
];

const CHAPTERS = [
  { t: 0, title: "Meet Rahul & Lakshmi", focus: null,
    en: "Meet Rahul and Lakshmi. And meet SAATHI — an AI that doesn't just talk. It acts.", kn: "" },
  { t: 6, title: "A suspicious payment", focus: ["saathi", "rahul", "audit"],
    en: "Midnight. ₹25,000, to a stranger. SAATHI flags it: risk 91.", kn: "" },
  { t: 13, title: "SAATHI calls Rahul", focus: ["saathi", "sarvam", "vobiz", "rahul"],
    en: "SAATHI calls Rahul in Kannada, through Sarvam and Vobiz. He says no — it wasn't him.", kn: "“Idu neevu maadidira?” — “Illa!”" },
  { t: 21, title: "Claude decides, tools act", focus: ["saathi", "claude", "audit"],
    en: "Claude understands his answer and picks the right tools. The payment is frozen.", kn: "" },
  { t: 28, title: "Approve → Telegram", focus: ["saathi", "rahul", "telegram", "audit"],
    en: "Rahul taps approve. A Telegram alert confirms the fraud case.", kn: "" },
  { t: 35, title: "Lakshmi's shop · Sheets", focus: ["lakshmi", "sarvam", "saathi", "sheets"],
    en: "Lakshmi asks how business is going. SAATHI reads her Google Sheet and spots rice running low.", kn: "“Aaj business hegide?”" },
  { t: 43, title: "Supplier taps ACCEPT", focus: ["lakshmi", "saathi", "telegram", "supplier", "sheets"],
    en: "She says yes. The order reaches her supplier on Telegram — accepted in one tap.", kn: "“Howdu, order maadi.”" },
  { t: 50, title: "Snap & Act", focus: ["lakshmi", "saathi", "claude", "telegram", "supplier"],
    en: "She snaps a supplier bill. Claude vision catches a ₹200 overcharge.", kn: "" },
  { t: 57, title: "Verified & logged", focus: null,
    en: "Every step, verified and logged. Don't just tell me what happened. Help me fix it.", kn: "" },
] as const;

// ── timeline helpers ─────────────────────────────────────────────────────────
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const win = (t: number, a: number, b: number) => t >= a && t < b;
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function chapterAt(t: number) {
  let i = 0;
  CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; });
  return i;
}

function curve(a: NodeId, b: NodeId) {
  const e = EDGES.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))!;
  const [ax, ay] = POS[e.a], [bx, by] = POS[e.b];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
  const cx = (ax + bx) / 2 + (-dy / len) * e.k * len, cy = (ay + by) / 2 + (dx / len) * e.k * len;
  return { e, reversed: e.a !== a, ax, ay, bx, by, cx, cy };
}

function pointOn(a: NodeId, b: NodeId, p: number) {
  const q = curve(a, b);
  const s = q.reversed ? 1 - p : p;
  const u = 1 - s;
  return [u * u * q.ax + 2 * u * s * q.cx + s * s * q.bx, u * u * q.ay + 2 * u * s * q.cy + s * s * q.by];
}

// ── cartoon cast ─────────────────────────────────────────────────────────────
type Mood = "idle" | "talk" | "happy" | "alarmed";
const CAST = {
  rahul: { skin: "#f3c7a2", hair: "#2b2118", shirt: "#3b82f6", name: "Rahul", role: "Saver" },
  lakshmi: { skin: "#e8b089", hair: "#1f1a17", shirt: "#f97316", name: "Lakshmi", role: "Kirana owner" },
  supplier: { skin: "#d49b72", hair: "#3a2a1e", shirt: "#16a34a", name: "Raju Traders", role: "Supplier" },
} as const;

function Character({ who, mood }: { who: keyof typeof CAST; mood: Mood }) {
  const p = CAST[who];
  return (
    <svg viewBox="0 0 120 130" width={112} height={121} aria-hidden>
      <ellipse cx="60" cy="125" rx="36" ry="5" fill="rgba(15,23,42,.12)" />
      <path d="M20 126 C20 97 37 86 60 86 C83 86 100 97 100 126 Z" fill={p.shirt} />
      <path d="M26 110 C34 100 44 96 52 95" stroke="rgba(255,255,255,.35)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M48 89 L60 101 L72 89" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="52" y="73" width="16" height="17" rx="7" fill={p.skin} />
      {who === "lakshmi" && <circle cx="60" cy="19" r="13" fill={p.hair} />}
      {who === "lakshmi" && <circle cx="72" cy="15" r="4" fill="#f43f5e" />}
      <circle cx="30" cy="52" r="6.5" fill={p.skin} />
      <circle cx="90" cy="52" r="6.5" fill={p.skin} />
      <circle cx="60" cy="50" r="30" fill={p.skin} />
      <ellipse cx="48" cy="34" rx="9" ry="5" fill="rgba(255,255,255,.3)" />
      {who === "rahul" && <path d="M30 47 C29 22 46 15 62 16 C80 16 93 27 90 47 C85 35 74 30 61 32 C47 30 37 36 30 47 Z" fill={p.hair} />}
      {who === "lakshmi" && <><path d="M30 54 C28 26 44 18 60 18 C76 18 92 26 90 54 C86 38 76 30 60 31 C44 30 34 38 30 54 Z" fill={p.hair} /><circle cx="60" cy="37" r="2.8" fill="#e11d48" /></>}
      {who === "supplier" && <><path d="M30 41 C32 22 46 16 60 16 C76 16 88 24 90 41 Z" fill="#0f766e" /><rect x="58" y="36" width="44" height="7" rx="3.5" fill="#0f766e" />
        <path d="M47 65 C53 60 58 62 60 64 C62 62 67 60 73 65 C66 69 54 69 47 65 Z" fill={p.hair} /></>}
      <circle cx="41" cy="61" r="5.5" fill="#fb7185" opacity=".32" />
      <circle cx="79" cy="61" r="5.5" fill="#fb7185" opacity=".32" />
      {mood === "alarmed" && <><path d="M42 40 L54 43" stroke="#1e293b" strokeWidth="2.6" strokeLinecap="round" /><path d="M78 40 L66 43" stroke="#1e293b" strokeWidth="2.6" strokeLinecap="round" /></>}
      <g className="dv-blink">
        <ellipse cx="49" cy="51" rx="3.8" ry={mood === "alarmed" ? 5 : 4.3} fill="#1e293b" />
        <ellipse cx="71" cy="51" rx="3.8" ry={mood === "alarmed" ? 5 : 4.3} fill="#1e293b" />
      </g>
      <circle cx="50.3" cy="49.4" r="1.2" fill="#fff" />
      <circle cx="72.3" cy="49.4" r="1.2" fill="#fff" />
      {mood === "talk" && <ellipse className="dv-talk" cx="60" cy={who === "supplier" ? 70 : 67} rx="6" ry="4.4" fill="#7f1d1d" />}
      {mood === "happy" && <path d={who === "supplier" ? "M50 68 Q60 77 70 68" : "M49 63 Q60 75 71 63"} stroke="#7f1d1d" strokeWidth="3.2" fill="#fecaca" strokeLinecap="round" />}
      {mood === "alarmed" && <ellipse cx="60" cy="68" rx="4.2" ry="5.2" fill="#7f1d1d" />}
      {mood === "idle" && <path d={who === "supplier" ? "M53 70 Q60 73 67 70" : "M52 65 Q60 70 68 65"} stroke="#7f1d1d" strokeWidth="3" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

function Mascot({ mood, alert }: { mood: "idle" | "think" | "alert" | "happy"; alert: boolean }) {
  const eye = mood === "alert" ? "#be123c" : "#064e3b";
  return (
    <svg viewBox="0 0 160 160" width={150} height={150} aria-hidden>
      <defs>
        <radialGradient id="dvBody" cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor={alert ? "#fecdd3" : "#a7f3d0"} />
          <stop offset=".55" stopColor={alert ? "#fb7185" : "#34d399"} />
          <stop offset="1" stopColor={alert ? "#e11d48" : "#0d9488"} />
        </radialGradient>
      </defs>
      <ellipse cx="80" cy="150" rx="46" ry="6" fill="rgba(15,23,42,.13)" />
      <line x1="80" y1="34" x2="80" y2="14" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" />
      <circle className={mood === "think" || alert ? "dv-glow" : ""} cx="80" cy="12" r="7" fill={alert ? "#f43f5e" : "#fbbf24"} />
      <ellipse cx="22" cy="92" rx="10" ry="16" fill="url(#dvBody)" transform="rotate(-18 22 92)" />
      <ellipse cx="138" cy="92" rx="10" ry="16" fill="url(#dvBody)" transform="rotate(18 138 92)" />
      <rect x="24" y="30" width="112" height="112" rx="50" fill="url(#dvBody)" />
      <ellipse cx="56" cy="50" rx="20" ry="9" fill="rgba(255,255,255,.45)" />
      <rect x="40" y="58" width="80" height="54" rx="26" fill="#f0fdf9" />
      <g className="dv-blink">
        {mood === "happy" ? (
          <><path d="M57 84 Q63 76 69 84" stroke={eye} strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M91 84 Q97 76 103 84" stroke={eye} strokeWidth="4" fill="none" strokeLinecap="round" /></>
        ) : (
          <><ellipse cx="63" cy="82" rx="6" ry={mood === "think" ? 4 : 7.5} fill={eye} /><ellipse cx="97" cy="82" rx="6" ry={mood === "think" ? 4 : 7.5} fill={eye} /></>
        )}
      </g>
      {mood !== "happy" && <><circle cx="65" cy="79" r="2" fill="#fff" /><circle cx="99" cy="79" r="2" fill="#fff" /></>}
      {mood === "alert" ? <ellipse cx="80" cy="101" rx="6" ry="4" fill={eye} /> : <path d="M70 97 Q80 106 90 97" stroke={eye} strokeWidth="3.5" fill="none" strokeLinecap="round" />}
      <circle cx="50" cy="98" r="5" fill="#fb7185" opacity=".3" />
      <circle cx="110" cy="98" r="5" fill="#fb7185" opacity=".3" />
    </svg>
  );
}

// ── stage building blocks ────────────────────────────────────────────────────
function At({ x, y, show = true, children, className, z = 10 }: { x: number; y: number; show?: boolean; children: ReactNode; className?: string; z?: number }) {
  return (
    <div className={clsx("absolute transition-[opacity,transform] duration-500 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)]", className)}
      style={{ left: x, top: y, zIndex: z, opacity: show ? 1 : 0, transform: `translate(-50%, -50%) scale(${show ? 1 : 0.6})`, pointerEvents: "none" }}>
      {children}
    </div>
  );
}

function Service({ icon: Icon, name, sub, tint, active, dim, children }: { icon: any; name: string; sub: string; tint: string; active: boolean; dim: boolean; children?: ReactNode }) {
  return (
    <div className={clsx("clay-sm relative w-[158px] px-3 py-2.5 transition-all duration-500", dim && "opacity-40 saturate-50")}
      style={{ transform: active ? "scale(1.08)" : "scale(1)", boxShadow: active ? `0 0 0 4px ${tint}33, 0 16px 30px -14px ${tint}` : undefined }}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-[inset_0_-3px_6px_rgba(0,0,0,.15),inset_0_2px_4px_rgba(255,255,255,.4)]" style={{ background: tint }}><Icon size={19} /></span>
        <div className="min-w-0">
          <div className="text-[14px] font-bold leading-tight text-slate-900">{name}</div>
          <div className="truncate text-[11px] font-medium text-slate-500">{sub}</div>
        </div>
      </div>
      {children}
      {active && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full" style={{ background: tint }}><span className="absolute inset-0 animate-ping rounded-full" style={{ background: tint }} /></span>}
    </div>
  );
}

function Person({ who, mood, dim, active, extra }: { who: keyof typeof CAST; mood: Mood; dim: boolean; active: boolean; extra?: ReactNode }) {
  const p = CAST[who];
  return (
    <div className={clsx("flex flex-col items-center transition-all duration-500", dim && "opacity-40 saturate-50")} style={{ transform: active ? "scale(1.06)" : undefined }}>
      <div className="relative">
        <div className="absolute inset-x-1 bottom-0 h-[84px] rounded-full" style={{ background: `radial-gradient(circle at 50% 40%, ${p.shirt}22, transparent 70%)` }} />
        <Character who={who} mood={mood} />
        {extra}
      </div>
      <div className={clsx("clay-sm whitespace-nowrap !rounded-full px-3 py-1 text-center", extra ? "mt-4" : "-mt-1")}>
        <span className="text-[13px] font-bold text-slate-900">{p.name}</span>
        <span className="ml-1.5 text-[11px] font-medium text-slate-500">{p.role}</span>
      </div>
    </div>
  );
}

function Bubble({ show, children, tone = "white", tail = "down", w = 230 }: { show: boolean; children: ReactNode; tone?: "white" | "sky" | "violet" | "emerald"; tail?: "down" | "none"; w?: number }) {
  const cls = { white: "bg-white text-slate-800", sky: "bg-sky-500 text-white", violet: "bg-violet-500 text-white", emerald: "bg-emerald-500 text-white" }[tone];
  return (
    <div className={clsx("relative rounded-2xl px-3.5 py-2.5 text-[14px] font-medium leading-snug shadow-[0_14px_28px_-14px_rgba(15,23,42,.45)] transition-all duration-500", cls)}
      style={{ width: w, opacity: show ? 1 : 0, transform: show ? "translateY(0) scale(1)" : "translateY(10px) scale(.85)" }}>
      {children}
      {tail === "down" && <span className={clsx("absolute -bottom-1.5 left-8 h-4 w-4 rotate-45 rounded-sm", cls.split(" ")[0])} />}
    </div>
  );
}

function Tap({ x, y, at, t }: { x: number; y: number; at: number; t: number }) {
  // a cartoon finger that glides in, presses, and leaves
  const p = prog(t, at - 0.8, at);
  const pressed = win(t, at, at + 0.25);
  const show = win(t, at - 0.8, at + 0.7);
  return (
    <div className="absolute z-40 text-[30px] transition-opacity duration-300" style={{ left: x + (1 - ease(p)) * 60, top: y + (1 - ease(p)) * 50, opacity: show ? 1 : 0, transform: `scale(${pressed ? 0.85 : 1})`, pointerEvents: "none" }}>
      👆{pressed && <span className="absolute -left-3 -top-3 h-10 w-10 rounded-full border-4 border-white/90 ring-wave" />}
    </div>
  );
}

// ── the stage ────────────────────────────────────────────────────────────────
function Stage({ t }: { t: number }) {
  const ch = chapterAt(t);
  const focus = CHAPTERS[ch].focus as readonly string[] | null;
  const dim = (id: NodeId) => !!focus && !focus.includes(id) && t > 5.5;
  const shown = (id: NodeId) => t >= APPEAR[id];
  const live = PACKETS.filter((p) => t >= p.t0 && t < p.t0 + p.d);
  const arrived = (id: NodeId) => PACKETS.some((p) => (p.b === id && t >= p.t0 + p.d && t < p.t0 + p.d + 0.6) || (p.a === id && t >= p.t0 && t < p.t0 + 0.4));
  const edgeLive = (e: (typeof EDGES)[number]) => live.find((p) => (p.a === e.a && p.b === e.b) || (p.a === e.b && p.b === e.a));
  const finale = t >= 59.8;

  // moods
  const rahulMood: Mood = win(t, 18.9, 21.2) ? "talk" : win(t, 31, 36) ? "happy" : win(t, 6.6, 18.9) ? "alarmed" : t >= 59.8 ? "happy" : "idle";
  const lakshmiMood: Mood = win(t, 35.3, 37.6) || win(t, 43.3, 45.2) ? "talk" : win(t, 41.2, 43.3) ? "alarmed" : win(t, 49.8, 51) || win(t, 55.1, 57.5) || t >= 59.8 ? "happy" : "idle";
  const supplierMood: Mood = win(t, 47.3, 50) ? "happy" : win(t, 57, 58.2) ? "alarmed" : t >= 59.8 ? "happy" : "idle";
  const alert = win(t, 8, 21.2);
  const mascotMood = finale || win(t, 31.6, 35) || win(t, 49.8, 50.5) ? "happy" : alert ? "alert" : win(t, 21.2, 25) || win(t, 37.3, 39.8) || win(t, 52.2, 55.1) ? "think" : "idle";

  const risk = Math.round(91 * ease(prog(t, 8.2, 10.4)));
  const riskColor = risk > 70 ? "#f43f5e" : risk > 35 ? "#f59e0b" : "#10b981";
  const callTimer = Math.max(0, Math.floor(t - 17.2));
  const auditDone = Math.floor(prog(t, 57.4, 60.1) * 6 + (t >= 60.1 ? 0.01 : 0));
  const auditCount = PACKETS.filter((p) => p.b === "audit" && t >= p.t0 + p.d).length;

  // flying transaction card (enters from the "bank", top-right)
  const fly = ease(prog(t, 6.3, 8.0));
  const txnX = 1360 + (680 - 1360) * fly, txnY = -40 + (270 - -40) * fly;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ width: W, height: H }}>
      {/* backdrop */}
      <div className="absolute inset-0 bg-[linear-gradient(170deg,#effbf6_0%,#f7f9ff_45%,#fff6ec_100%)]" />
      <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(15,23,42,.07)_1.4px,transparent_1.4px)] [background-size:32px_32px]" />
      <div className="absolute -left-20 top-[420px] h-[360px] w-[520px] rounded-full bg-emerald-100/70 blur-2xl" />
      <div className="absolute -right-24 top-[380px] h-[380px] w-[560px] rounded-full bg-amber-100/70 blur-2xl" />
      {[60, 210, 330].map((y, i) => (
        <div key={y} className="dv-cloud absolute left-0" style={{ top: y, animationDelay: `${-i * 21}s`, animationDuration: `${60 + i * 14}s` }}>
          <div className="relative h-9 w-28 rounded-full bg-white/80 shadow-[0_8px_20px_-12px_rgba(15,23,42,.25)]"><span className="absolute -top-4 left-5 h-12 w-12 rounded-full bg-white/80" /><span className="absolute -top-2 left-12 h-10 w-10 rounded-full bg-white/80" /></div>
        </div>
      ))}
      {/* night overlay while the fraud attempt happens */}
      <div className="absolute inset-0 bg-indigo-950 transition-opacity duration-700" style={{ opacity: win(t, 6.2, 12.6) ? 0.07 : 0 }} />

      {/* connections */}
      <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {EDGES.map((e) => {
          const q = curve(e.a, e.b);
          const vis = t >= Math.max(APPEAR[e.a], APPEAR[e.b]) + 0.3;
          const lp = edgeLive(e);
          const d = `M${q.ax} ${q.ay} Q${q.cx} ${q.cy} ${q.bx} ${q.by}`;
          return (
            <g key={`${e.a}-${e.b}`} style={{ opacity: vis ? 1 : 0, transition: "opacity .6s" }}>
              <path d={d} fill="none" stroke="#ffffff" strokeWidth={9} strokeLinecap="round" opacity={0.9} />
              <path d={d} fill="none" stroke={lp ? lp.c : finale ? "#6ee7b7" : "#cbd5e1"} strokeWidth={lp ? 4 : 3} strokeDasharray="2 12" strokeLinecap="round"
                className={lp || finale ? "dv-dash" : ""} style={{ transition: "stroke .3s" }} />
            </g>
          );
        })}
      </svg>

      {/* people */}
      <At x={POS.rahul[0]} y={POS.rahul[1]} show={shown("rahul")}>
        <Person who="rahul" mood={rahulMood} dim={dim("rahul")} active={arrived("rahul")} />
      </At>
      <At x={POS.lakshmi[0]} y={POS.lakshmi[1]} show={shown("lakshmi")}>
        <Person who="lakshmi" mood={lakshmiMood} dim={dim("lakshmi")} active={arrived("lakshmi")}
          extra={<svg viewBox="0 0 140 40" width={150} className="absolute -bottom-3 left-1/2 -translate-x-1/2" aria-hidden>
            <rect x="6" y="6" width="128" height="30" rx="9" fill="#fde68a" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={6 + i * 16} y="6" width="8" height="30" fill="#fb923c" opacity=".55" />)}
            <rect x="6" y="6" width="128" height="30" rx="9" fill="none" stroke="#f59e0b" strokeWidth="2" />
            <text x="70" y="26" textAnchor="middle" fontSize="12" fontWeight="800" fill="#7c2d12">LAKSHMI KIRANA</text>
          </svg>} />
      </At>
      <At x={POS.supplier[0]} y={POS.supplier[1]} show={shown("supplier")}>
        <Person who="supplier" mood={supplierMood} dim={dim("supplier")} active={arrived("supplier")} />
      </At>

      {/* SAATHI hub */}
      <At x={POS.saathi[0]} y={POS.saathi[1]} show={shown("saathi")} z={20}>
        <div className="relative flex flex-col items-center">
          {(arrived("saathi") || alert || finale) && <>
            <span className="ring-wave absolute left-1/2 top-[70px] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: alert ? "#fecdd3" : "#a7f3d0" }} />
            <span className="ring-wave absolute left-1/2 top-[70px] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: alert ? "#fecdd3" : "#a7f3d0", animationDelay: ".8s" }} />
          </>}
          <div className="dv-bob relative"><Mascot mood={mascotMood} alert={alert} /></div>
          <div className="clay-sm -mt-1 !rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1 text-[14px] font-extrabold tracking-wide text-white">SAATHI</div>
        </div>
      </At>

      {/* services */}
      <At x={POS.claude[0]} y={POS.claude[1]} show={shown("claude")}>
        <Service icon={Sparkles} name="Claude" sub={win(t, 52.4, 55.1) ? "vision · reading bill" : "reasoning · routing"} tint={C.claude} active={arrived("claude") || win(t, 22.2, 24) || win(t, 53.2, 54.4)} dim={dim("claude")}>
          <div className="overflow-hidden transition-all duration-500" style={{ maxHeight: win(t, 22.2, 24.2) ? 40 : 0 }}>
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-orange-50 px-2 py-1.5 text-[11px] font-semibold text-orange-700">
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: `${i * 0.15}s` }} />)} intent: fraud_confirm
            </div>
          </div>
          <div className="overflow-hidden transition-all duration-500" style={{ maxHeight: win(t, 53.2, 55.2) ? 80 : 0 }}>
            <div className="relative mt-2 overflow-hidden rounded-lg bg-[#fbfaf6] px-2 py-1.5 font-mono text-[10px] leading-tight text-stone-700 ring-1 ring-stone-200">
              <div>Rice 50 KG @52 = 2,600</div><div>Sugar 20 KG @40 = 800</div><div className="font-bold">TOTAL ₹3,400</div>
              <div className="absolute inset-x-0 h-5 bg-gradient-to-b from-transparent via-sky-400/50 to-transparent" style={{ top: `${prog(t, 53.2, 54.4) * 100}%` }} />
            </div>
          </div>
        </Service>
      </At>
      <At x={POS.vobiz[0]} y={POS.vobiz[1]} show={shown("vobiz")}>
        <Service icon={PhoneCall} name="Vobiz" sub={win(t, 15.2, 21) ? "on call · +91 ··· 0441" : "real phone calls"} tint="#f97316" active={arrived("vobiz") || win(t, 16.1, 21)} dim={dim("vobiz")} />
      </At>
      <At x={POS.sarvam[0]} y={POS.sarvam[1]} show={shown("sarvam")}>
        <Service icon={AudioWaveform} name="Sarvam AI" sub={live.some((p) => p.b === "sarvam" && p.c === C.voice && (p.a === "rahul" || p.a === "vobiz" || p.a === "lakshmi")) ? "speech → text" : "Kannada voice · STT/TTS"} tint={C.voice} active={arrived("sarvam")} dim={dim("sarvam")}>
          <div className="mt-1.5 flex h-4 items-center gap-[2px]">
            {Array.from({ length: 22 }).map((_, i) => (
              <span key={i} className={clsx("w-[3px] rounded-full bg-violet-400", arrived("sarvam") && "eq-bar")} style={{ height: arrived("sarvam") ? `${35 + ((i * 41) % 65)}%` : "25%", animationDelay: `${(i % 6) * 0.08}s` }} />
            ))}
          </div>
        </Service>
      </At>
      <At x={POS.telegram[0]} y={POS.telegram[1]} show={shown("telegram")}>
        <Service icon={Send} name="Telegram" sub="alerts · approvals · POs" tint={C.tg} active={arrived("telegram")} dim={dim("telegram")} />
      </At>
      <At x={POS.sheets[0]} y={POS.sheets[1]} show={shown("sheets")}>
        <div className={clsx("clay-sm w-[262px] p-3 transition-all duration-500", dim("sheets") && "opacity-40 saturate-50")}
          style={{ transform: arrived("sheets") ? "scale(1.06)" : undefined, boxShadow: arrived("sheets") ? `0 0 0 4px ${C.data}33, 0 16px 30px -14px ${C.data}` : undefined }}>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-white shadow-[inset_0_-3px_6px_rgba(0,0,0,.15)]"><FileSpreadsheet size={16} /></span>
            <div><div className="text-[14px] font-bold leading-tight text-slate-900">Google Sheets</div><div className="text-[11px] font-medium text-slate-500">live store data</div></div>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg ring-1 ring-slate-200">
            <div className="grid grid-cols-[1fr_54px_92px] bg-emerald-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white"><span>Item</span><span>Stock</span><span>Status</span></div>
            {[
              ["Rice", "8 KG", t >= 38.6 ? "LOW ⚠" : "—", t >= 38.6 && t < 49.8 ? "bg-rose-50 text-rose-700" : ""],
              ["Tea", "12 KG", "OK", ""],
              ["PO-3051", "50 KG", t >= 49.8 ? "CONFIRMED" : t >= 44.5 ? "SENT" : "—", t >= 49.8 ? "bg-emerald-50 font-bold text-emerald-700" : t >= 44.5 ? "bg-sky-50 text-sky-700" : ""],
            ].map(([a, b, c, cls], i) => (
              <div key={i} className={clsx("relative grid grid-cols-[1fr_54px_92px] border-t border-slate-100 px-2 py-1 text-[11.5px] text-slate-700 transition-colors duration-500", cls)}>
                <span className="whitespace-nowrap font-semibold">{a}</span><span className="tabular-nums">{b}</span><span>{c}</span>
              </div>
            ))}
            <div className="relative h-0">
              {win(t, 38.3, 39.3) && <div className="absolute inset-x-0 h-6 -translate-y-full bg-gradient-to-b from-transparent via-emerald-300/50 to-transparent" style={{ transform: `translateY(-${(1 - prog(t, 38.3, 39.3)) * 80}px)` }} />}
            </div>
          </div>
        </div>
      </At>
      <At x={POS.audit[0]} y={POS.audit[1]} show={shown("audit")}>
        <div className={clsx("clay-sm w-[400px] px-3.5 py-2.5 transition-all duration-500", dim("audit") && "opacity-40 saturate-50")}
          style={{ transform: arrived("audit") ? "scale(1.05)" : undefined }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-white"><ScrollText size={15} /></span>
              <div className="text-[14px] font-bold text-slate-900">Audit trail</div>
            </div>
            <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">{auditCount} {auditCount === 1 ? "entry" : "entries"}</div>
          </div>
          <div className="mt-2 flex gap-1">
            {["SAID", "UNDERSTOOD", "DECIDED", "APPROVED", "EXECUTED", "VERIFIED"].map((s, i) => {
              const on = i < auditDone;
              return (
                <span key={s} className={clsx("flex-1 rounded-md py-1 text-center text-[9.5px] font-bold transition-all duration-300", on ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-100 text-slate-400")}
                  style={{ transform: i === auditDone - 1 ? "scale(1.12)" : undefined }}>{on ? "✓ " : ""}{s}</span>
              );
            })}
          </div>
        </div>
      </At>

      {/* ── chapter widgets ─────────────────────────────────────────────── */}
      {/* incoming payment */}
      <div className="absolute z-30" style={{ left: txnX, top: txnY, transform: `translate(-50%,-50%) scale(${1 - prog(t, 7.6, 8.0) * 0.6})`, opacity: win(t, 6.3, 8.0) ? 1 : 0, transition: "opacity .2s" }}>
        <div className="clay-sm flex w-[230px] items-center gap-3 px-3 py-2.5 ring-2 ring-rose-200">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500 text-[18px] text-white">₹</span>
          <div><div className="text-[16px] font-extrabold text-slate-900">₹25,000 → new UPI</div><div className="text-[11.5px] font-medium text-slate-500">🌙 11:47 PM · first-time payee</div></div>
        </div>
      </div>
      {/* fraud risk meter */}
      <At x={800} y={300} show={win(t, 8.1, 21.2)} z={25}>
        <div className="clay-sm flex items-center gap-2.5 px-3 py-2.5">
          <div className="relative grid h-[68px] w-[68px] place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="12" />
              <circle cx="50" cy="50" r="40" fill="none" stroke={riskColor} strokeWidth="12" strokeLinecap="round" pathLength={100} strokeDasharray={`${risk} 100`} />
            </svg>
            <span className="text-[20px] font-black tabular-nums text-slate-900">{risk}</span>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fraud risk</div>
            <div className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: riskColor }}>{risk > 70 ? "HIGH · verify" : "scoring…"}</div>
            <div className="mt-0.5 text-[10.5px] text-slate-500">new payee · late night · 6× usual</div>
          </div>
        </div>
      </At>
      {/* incoming call card (under Rahul) */}
      <At x={115} y={318} show={win(t, 16.1, 21.4)} z={30}>
        <div className="clay w-[210px] !rounded-[22px] p-3">
          <div className="flex items-center gap-2.5">
            <div className="relative grid h-11 w-11 place-items-center">
              {t < 17.2 && <><span className="ring-wave absolute inset-0 rounded-full bg-emerald-300/60" /><span className="ring-wave absolute inset-0 rounded-full bg-emerald-300/40" style={{ animationDelay: ".6s" }} /></>}
              <span className="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white"><PhoneCall size={18} className={t < 17.2 ? "ring-shake" : ""} /></span>
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-slate-900">SAATHI</div>
              <div className="text-[11px] font-semibold tabular-nums text-emerald-600">{t < 17.2 ? "Incoming call…" : `00:${String(callTimer).padStart(2, "0")} · Kannada`}</div>
            </div>
          </div>
          {t < 17.2 ? (
            <div className="mt-2.5 flex justify-around">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-rose-500 text-white">✕</span>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white" style={{ transform: win(t, 16.9, 17.2) ? "scale(.85)" : undefined }}>✓</span>
            </div>
          ) : (
            <>
              <div className="mt-2 flex h-5 items-center gap-[2px]">{Array.from({ length: 26 }).map((_, i) => <span key={i} className="eq-bar w-[3px] rounded-full bg-emerald-500/80" style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 6) * 0.1}s` }} />)}</div>
              <div className="mt-1.5 rounded-xl bg-slate-50 px-2.5 py-1.5 text-[11.5px] leading-snug text-slate-700">🔊 “Namaskara Rahul, ₹25,000 transaction… <b>idu neevu maadidira?</b>”</div>
            </>
          )}
        </div>
      </At>
      <Tap x={150} y={330} at={16.95} t={t} />
      {/* Rahul's reply */}
      <div className="absolute z-30" style={{ left: 30, top: 18 }}>
        <Bubble show={win(t, 18.9, 21.3)} tone="sky">“Illa! Naanu maadilla.” <span className="block text-[11.5px] font-normal opacity-80">No — that wasn't me.</span></Bubble>
      </div>
      {/* tool chips */}
      {[["freeze_transaction()", 500, 418, 25.0], ["create_fraud_case()", 790, 418, 25.5], ["notify_bank()", 640, 448, 26.0]].map(([label, x, y, at]) => (
        <At key={label as string} x={x as number} y={y as number} show={win(t, at as number, 28.2)} z={25}>
          <div className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 font-mono text-[12px] font-semibold text-emerald-300 shadow-lg"><Check size={13} /> {label}</div>
        </At>
      ))}
      {/* approval card (under Rahul) */}
      <At x={115} y={322} show={win(t, 28.7, 33.4)} z={30}>
        <div className="clay w-[214px] !rounded-[22px] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">SAATHI needs your OK</div>
          <div className="mt-1 text-[13.5px] font-bold leading-snug text-slate-900">Block ₹25,000 & report fraud?</div>
          {t < 30.5 ? (
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[12px] font-bold">
              <span className="rounded-xl bg-slate-100 py-1.5 text-center text-slate-600">Not now</span>
              <span className="rounded-xl bg-emerald-500 py-1.5 text-center text-white" style={{ transform: win(t, 30.2, 30.5) ? "scale(.9)" : undefined }}>Approve</span>
            </div>
          ) : (
            <div className="mt-2 rounded-xl bg-emerald-50 py-1.5 text-center text-[12.5px] font-bold text-emerald-700">✓ Approved · blocking</div>
          )}
        </div>
      </At>
      <Tap x={160} y={348} at={30.3} t={t} />
      {/* Telegram messages */}
      {[
        { a: 32.6, b: 35.6, head: "🚨 SAATHI Alert", body: "₹25,000 payment BLOCKED · Case FC-1021 · bank notified" },
        { a: 45.3, b: 47.2, head: "🧾 Purchase order PO-3051", body: "Rice 50 KG · ₹2,400 · deliver tomorrow" },
        { a: 56.3, b: 57.9, head: "⚠ Bill dispute", body: "₹52/kg billed vs ₹48 agreed — please revise to ₹3,200" },
      ].map((m) => (
        <At key={m.a} x={905} y={262} show={win(t, m.a, m.b)} z={30}>
          <div className="w-[236px] rounded-2xl rounded-tl-md bg-[#eaf6fd] p-2.5 text-[12px] leading-snug text-slate-700 shadow-[0_14px_28px_-14px_rgba(34,158,217,.7)] ring-1 ring-sky-200">
            <div className="font-bold text-slate-900">{m.head}</div>{m.body}
          </div>
        </At>
      ))}
      {/* supplier's phone */}
      <At x={1168} y={455} show={win(t, 46.2, 50.2)} z={30}>
        <div className="w-[172px] rounded-[22px] bg-slate-900 p-1.5 shadow-xl">
          <div className="rounded-[17px] bg-[#e9eef3] p-2">
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-700"><Send size={11} className="text-[#229ed9]" /> SAATHI bot</div>
            <div className="mt-1.5 rounded-xl bg-white p-2 text-[11px] leading-snug text-slate-700 shadow-sm"><b>PO-3051</b> · Rice 50 KG · ₹2,400</div>
            {t < 47.3 ? (
              <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10.5px] font-bold">
                <span className="rounded-lg bg-[#eaf3fc] py-1 text-center text-[#2481cc]" style={{ transform: win(t, 47.05, 47.3) ? "scale(.88)" : undefined }}>✅ ACCEPT</span>
                <span className="rounded-lg bg-[#eaf3fc] py-1 text-center text-[#2481cc]">✖ REJECT</span>
              </div>
            ) : (
              <div className="mt-1.5 rounded-lg bg-emerald-500 py-1 text-center text-[10.5px] font-bold text-white">✓ Accepted</div>
            )}
          </div>
        </div>
      </At>
      <Tap x={1110} y={470} at={47.1} t={t} />
      {/* Lakshmi's speech + SAATHI's spoken replies (above her head) */}
      <div className="absolute z-30" style={{ left: 22, top: 318 }}>
        <div className="relative">
          <div className="absolute bottom-0 left-0"><Bubble show={win(t, 35.3, 37.7)} tone="sky" w={220}>“Aaj business hegide?” <span className="block text-[11.5px] font-normal opacity-80">How's business today?</span></Bubble></div>
          <div className="absolute bottom-0 left-0"><Bubble show={win(t, 41.2, 43.2)} tone="violet" w={268}>🔊 Sales <b>+29.6%</b> 👍 — but rice is only <b>8 KG</b>. 50 KG order maadla? ₹2,400</Bubble></div>
          <div className="absolute bottom-0 left-0"><Bubble show={win(t, 43.3, 45.3)} tone="sky" w={220}>“Howdu, order maadi.” <span className="block text-[11.5px] font-normal opacity-80">Yes, place the order.</span></Bubble></div>
        </div>
      </div>
      {/* bill photo */}
      <At x={140} y={330} show={win(t, 50.3, 51.7)} z={30}>
        <div className="relative w-[150px] rotate-[-4deg] rounded-xl bg-[#fbfaf6] p-2.5 font-mono text-[10px] leading-tight text-stone-700 shadow-xl ring-4 ring-white">
          <div className="text-center text-[10.5px] font-bold text-stone-900">ABC STORES</div>
          <div className="mt-1">Rice 50 KG @52</div><div>Sugar 20 KG @40</div><div className="mt-0.5 border-t border-stone-300 pt-0.5 font-bold">TOTAL ₹3,400</div>
          <div className="absolute inset-0 rounded-xl bg-white transition-opacity duration-200" style={{ opacity: win(t, 50.7, 50.9) ? 0.95 : 0 }} />
          <span className="absolute -right-3 -top-3 grid h-8 w-8 place-items-center rounded-full bg-sky-500 text-[15px] text-white shadow">📷</span>
        </div>
      </At>
      {/* overcharge chip */}
      <At x={812} y={392} show={win(t, 55.1, 57.6)} z={25}>
        <div className="clay-sm px-3 py-2 ring-2 ring-rose-200">
          <div className="text-[13px] font-extrabold text-rose-600">⚠ ₹200 overcharge</div>
          <div className="text-[11px] font-medium text-slate-500">₹52/kg billed · ₹48 agreed</div>
        </div>
      </At>

      {/* packets */}
      {live.map((p, i) => {
        const k = (t - p.t0) / p.d;
        const [x, y] = pointOn(p.a, p.b, ease(k));
        return (
          <div key={`${p.t0}-${p.a}-${i}`} className="absolute z-[35]" style={{ left: x, top: y, transform: "translate(-50%,-50%)", opacity: k > 0.82 ? (1 - k) / 0.18 : 1, pointerEvents: "none" }}>
            <span className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-[6px]" style={{ background: p.c }} />
            <span className="relative block h-[22px] w-[22px] rounded-full shadow-[inset_-3px_-4px_6px_rgba(0,0,0,.18),inset_3px_3px_5px_rgba(255,255,255,.55),0_6px_12px_-4px_rgba(15,23,42,.4)]" style={{ background: p.c }} />
            {p.label && <span className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-bold shadow" style={{ color: p.c }}>{p.label}</span>}
          </div>
        );
      })}

      {/* HUD */}
      <div className="absolute right-6 top-5 z-40 flex items-center gap-2 rounded-full bg-white/85 py-1.5 pl-2 pr-3.5 text-[13px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-emerald-500 px-1.5 text-[11px] text-white">{String(ch + 1).padStart(2, "0")}</span>
        {CHAPTERS[ch].title}
      </div>

      {/* finale */}
      <div className="absolute inset-0 z-50 grid place-items-center bg-white/60 backdrop-blur-[3px] transition-opacity duration-700" style={{ opacity: t >= 60.6 ? 1 : 0, pointerEvents: "none" }}>
        <div className="clay px-12 py-9 text-center transition-transform duration-700" style={{ transform: t >= 60.6 ? "scale(1)" : "scale(.85)" }}>
          <div className="mx-auto w-fit"><Mascot mood="happy" alert={false} /></div>
          <div className="mt-2 text-[15px] font-bold uppercase tracking-[0.2em] text-emerald-600">Every outcome verified</div>
          <div className="font-display mt-2 text-[40px] font-bold leading-tight tracking-tight text-slate-900">Don't just tell me what happened.<br /><span className="text-gradient">Help me fix it.</span></div>
        </div>
      </div>
    </div>
  );
}

// ── the player ───────────────────────────────────────────────────────────────
export function DemoVideo() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [cc, setCc] = useState(true);
  const [scale, setScale] = useState(0.8);
  const tRef = useRef(0);
  const frame = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const userPaused = useRef(false);
  const started = useRef(false);
  const [sound, setSound] = useState(false);
  const [seekTick, setSeekTick] = useState(0);
  const clips = useRef<HTMLAudioElement[]>([]);

  const seek = useCallback((v: number) => { tRef.current = Math.max(0, Math.min(TOTAL, v)); setT(tRef.current); setSeekTick((n) => n + 1); }, []);

  // playhead
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tRef.current = Math.min(TOTAL, tRef.current + dt);
      setT(tRef.current);
      if (tRef.current >= TOTAL) { setPlaying(false); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // voiceover: preload the clips once, then keep the current chapter's clip in step with the playhead
  useEffect(() => {
    clips.current = CHAPTERS.map((_, i) => { const a = new Audio(VO_SRC(i)); a.preload = "auto"; return a; });
    return () => clips.current.forEach((a) => a.pause());
  }, []);
  const chNow = chapterAt(t);
  useEffect(() => {
    const all = clips.current;
    all.forEach((a, i) => { if (i !== chNow) a.pause(); });
    const a = all[chNow];
    if (!a) return;
    if (!playing || !sound) { a.pause(); return; }
    const offset = tRef.current - CHAPTERS[chNow].t - VO_LEAD;
    const start = () => {
      if (offset > (a.duration || 99)) return;
      try { a.currentTime = Math.max(0, offset); } catch {}
      if (offset < 0) { const id = setTimeout(() => a.play().catch(() => {}), -offset * 1000); return () => clearTimeout(id); }
      a.play().catch(() => {});
    };
    const cleanup = start();
    return () => { if (cleanup) cleanup(); };
  }, [chNow, playing, sound, seekTick]);

  // fit the 1280×720 stage to the frame width
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // autoplay while on screen (unless the viewer paused it, or prefers reduced motion)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.45) {
        if (!reduce && !userPaused.current && tRef.current < TOTAL) { started.current = true; setPlaying(true); }
      } else setPlaying(false);
    }, { threshold: [0, 0.45] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    started.current = true;
    if (playing) { userPaused.current = true; setPlaying(false); return; }
    userPaused.current = false;
    setSound(true);
    if (tRef.current >= TOTAL) seek(0);
    setPlaying(true);
  };
  const jump = (v: number) => { started.current = true; setSound(true); seek(v); if (!playing) { userPaused.current = false; setPlaying(true); } };

  const ch = chapterAt(t);
  const ended = t >= TOTAL;

  // scrubbing on the progress track
  const track = useRef<HTMLDivElement>(null);
  const scrubTo = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    seek(((clientX - r.left) / r.width) * TOTAL);
  };

  return (
    <section id="demo" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <Reveal className="text-center">
          <Eyebrow>1-minute demo</Eyebrow>
          <h2 className="font-display mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
            <SplitWords text="Watch it work." highlight={["work."]} />
          </h2>
        </Reveal>

        <Reveal className="mt-12">
          <div ref={box} tabIndex={0} aria-label="SAATHI product demo player"
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
              if (e.key === "ArrowRight") seek(tRef.current + 5);
              if (e.key === "ArrowLeft") seek(tRef.current - 5);
            }}
            className="clay relative overflow-hidden !rounded-[30px] p-2 outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 md:p-3">
            {/* window chrome */}
            <div className="flex items-center justify-between px-3 pb-2 pt-1 md:px-4">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-rose-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                <span className={clsx("h-2 w-2 rounded-full", playing ? "live-dot bg-rose-500" : "bg-slate-300")} />
                saathi-how-it-works.mp4
              </div>
              <div className="w-12" />
            </div>

            {/* stage */}
            <div ref={frame} className={clsx("relative w-full overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-200/70", !playing && "dv-paused")}
              style={{ height: H * scale }} onClick={toggle}>
              <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
                <Stage t={t} />
              </div>

              {/* captions (overlay on wide screens) */}
              {cc && started.current && !ended && (
                <div className="pointer-events-none absolute inset-x-0 bottom-4 hidden justify-center px-6 md:flex">
                  <div key={ch} className="max-w-[78%] animate-slideUp rounded-2xl bg-slate-900/85 px-5 py-2.5 text-center text-[15px] font-medium leading-snug text-white shadow-xl backdrop-blur">
                    {CHAPTERS[ch].en}
                    {CHAPTERS[ch].kn && <div className="mt-0.5 text-[13px] italic text-emerald-300">{CHAPTERS[ch].kn}</div>}
                  </div>
                </div>
              )}

              {playing && !sound && (
                <button onClick={(e) => { e.stopPropagation(); setSound(true); setSeekTick((n) => n + 1); }}
                  className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-slate-900/85 py-2 pl-2.5 pr-4 text-[13px] font-semibold text-white shadow-lg backdrop-blur transition hover:bg-slate-900">
                  <span className="relative grid h-7 w-7 place-items-center rounded-full bg-emerald-500"><span className="ring-wave absolute inset-0 rounded-full bg-emerald-400/60" /><Volume2 size={15} className="relative" /></span>
                  Tap for voiceover
                </button>
              )}

              {/* big play button */}
              {!playing && (
                <div className="absolute inset-0 grid place-items-center bg-white/25 backdrop-blur-[1px]">
                  <button onClick={(e) => { e.stopPropagation(); toggle(); }} aria-label={ended ? "Replay" : "Play"}
                    className="group flex items-center gap-3 rounded-full bg-white/95 py-3 pl-3 pr-6 shadow-[0_20px_50px_-15px_rgba(15,23,42,.45)] transition hover:scale-105">
                    <span className="relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[inset_0_-4px_8px_rgba(0,0,0,.15),inset_0_3px_6px_rgba(255,255,255,.35)]">
                      <span className="ring-wave absolute inset-0 rounded-full bg-emerald-400/50" />
                      {ended ? <RotateCcw size={24} className="relative" /> : <Play size={24} className="relative ml-1" fill="currentColor" />}
                    </span>
                    <span className="text-left">
                      <span className="block text-[15px] font-bold text-slate-900">{ended ? "Watch again" : t > 0 ? "Resume" : "Watch how SAATHI works"}</span>
                      <span className="block text-[12px] font-medium text-slate-500">{fmt(TOTAL)} · with voiceover</span>
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* captions (below the frame on small screens) */}
            {cc && (
              <div className="mx-1 mt-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-[13px] leading-snug text-white md:hidden">
                {CHAPTERS[ch].en}
                {CHAPTERS[ch].kn && <div className="mt-0.5 text-[12px] italic text-emerald-300">{CHAPTERS[ch].kn}</div>}
              </div>
            )}

            {/* controls */}
            <div className="flex items-center gap-3 px-2 pb-1 pt-3 md:px-3">
              <button onClick={toggle} aria-label={playing ? "Pause" : "Play"}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-900 text-white shadow-[0_8px_18px_-8px_rgba(15,23,42,.7)] transition hover:bg-emerald-600 active:scale-95">
                {playing ? <Pause size={18} fill="currentColor" /> : ended ? <RotateCcw size={18} /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>
              <span className="w-[86px] shrink-0 font-mono text-[12.5px] tabular-nums text-slate-500">{fmt(t)} / {fmt(TOTAL)}</span>
              <div ref={track} className="relative flex h-6 flex-1 cursor-pointer touch-none items-center gap-[3px]"
                onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); started.current = true; scrubTo(e.clientX); }}
                onPointerMove={(e) => { if (e.buttons === 1) scrubTo(e.clientX); }}>
                {CHAPTERS.map((c, i) => {
                  const end = i + 1 < CHAPTERS.length ? CHAPTERS[i + 1].t : TOTAL;
                  const fill = prog(t, c.t, end);
                  return (
                    <div key={c.title} className="group relative h-2 rounded-full bg-slate-200 transition-[height] hover:h-3" style={{ flex: end - c.t }}>
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${fill * 100}%` }} />
                      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white group-hover:block">{c.title}</span>
                    </div>
                  );
                })}
                <span className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-emerald-500 shadow-md" style={{ left: `${(t / TOTAL) * 100}%` }} />
              </div>
              <button onClick={() => { setSound(!sound); setSeekTick((n) => n + 1); }} aria-label={sound ? "Mute voiceover" : "Play voiceover"} aria-pressed={sound}
                className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-xl transition", sound ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "text-slate-400 hover:text-slate-700")}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
              <button onClick={() => setCc(!cc)} aria-label="Toggle captions" aria-pressed={cc}
                className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-xl transition", cc ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "text-slate-400 hover:text-slate-700")}><Captions size={17} /></button>
              <button onClick={() => jump(0)} aria-label="Restart" className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:text-slate-700 sm:grid"><RotateCcw size={16} /></button>
            </div>
          </div>
        </Reveal>

        {/* chapters */}
        <div className="mt-5 flex snap-x gap-2 overflow-x-auto pb-2 md:grid md:grid-cols-9 md:overflow-visible">
          {CHAPTERS.map((c, i) => (
            <button key={c.title} onClick={() => jump(c.t + 0.01)}
              className={clsx("min-w-[140px] snap-start rounded-2xl px-3 py-2.5 text-left transition md:min-w-0",
                i === ch ? "clay-sm ring-2 ring-emerald-300" : "bg-white/60 ring-1 ring-slate-200/70 hover:bg-white")}>
              <div className={clsx("text-[10.5px] font-bold tabular-nums", i === ch ? "text-emerald-600" : "text-slate-400")}>{String(i + 1).padStart(2, "0")} · {fmt(c.t)}</div>
              <div className={clsx("mt-0.5 text-[12.5px] font-semibold leading-tight", i === ch ? "text-slate-900" : "text-slate-600")}>{c.title}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
