"use client";
import clsx from "clsx";
import {
  Activity, Bot, Boxes, Camera, CircleDollarSign, ShieldCheck, HandCoins, LayoutDashboard, Megaphone, PhoneCall, Play, Radar, RotateCcw,
  ShieldAlert, ShoppingCart, Siren, Smartphone, Square, Store, Volume2, VolumeX, Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { compactInr, inr, pct } from "@/services/format";

export const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "Monitor", hint: "Everything SAATHI is doing right now — from words to a verified result." },
  { id: "calls", label: "Live Calls", icon: PhoneCall, group: "Monitor", hint: "Voice verification calls SAATHI places when something looks wrong." },
  { id: "shield", label: "Scam Shield", icon: ShieldCheck, group: "Monitor", hint: "SAATHI listens to suspicious calls and warns the user live." },
  { id: "snap", label: "Snap & Act", icon: Camera, group: "Monitor", hint: "Photos of khata pages, bills and shelves turned into verified actions." },
  { id: "radar", label: "Financial Radar", icon: Radar, group: "Personal finance", hint: "Problems found before they happen — with a recommended fix." },
  { id: "fraud", label: "Fraud", icon: ShieldAlert, group: "Personal finance", hint: "Transactions scored by the Financial Safety Agent." },
  { id: "sos", label: "Money SOS", icon: Siren, group: "Personal finance", hint: "Urgent money needs, solved safely: insurance, savings, then credit." },
  { id: "health", label: "Merchant Health", icon: Store, group: "Merchant", hint: "Lakshmi General Stores at a glance — what matters most today." },
  { id: "cash", label: "Cash Reconciliation", icon: Wallet, group: "Merchant", hint: "Expected vs counted cash, reconciled with a reason." },
  { id: "inventory", label: "Inventory", icon: Boxes, group: "Merchant", hint: "Stock levels and automatic reorders." },
  { id: "credit", label: "Customer Credit", icon: HandCoins, group: "Merchant", hint: "Who owes what, and polite reminders on Telegram." },
  { id: "orders", label: "Orders", icon: ShoppingCart, group: "Merchant", hint: "Purchase orders and natural-language commerce." },
  { id: "campaigns", label: "Campaigns", icon: Megaphone, group: "Merchant", hint: "Growth offers — detected, created, published and measured." },
  { id: "agents", label: "AI Agents", icon: Bot, group: "System", hint: "Claude routes, six specialist agents reason, 52 tools act." },
  { id: "activity", label: "Activity Log", icon: Activity, group: "System", hint: "Every decision, tool call and approval — explainable." },
];
const GROUPS = ["Monitor", "Personal finance", "Merchant", "System"];
const INTEGRATION_NAMES: Record<string, string> = { claude: "Claude", sarvam: "Sarvam", vobiz: "Vobiz", telegram: "Telegram", sheets: "Sheets" };

function dotFor(status: string) {
  return status === "live" ? "bg-emerald-500" : status === "waiting" ? "bg-amber-500" : "bg-slate-300";
}

export function Sidebar({ view, setView, data }: { view: string; setView: (v: string) => void; data: any }) {
  const badges: Record<string, number> = {
    calls: data?.metrics?.active_calls || 0,
    radar: (data?.radar || []).filter((r: any) => r.level === "HIGH").length,
    shield: (data?.shield || []).filter((s: any) => s.status === "LISTENING").length,
  };
  const integrations = Object.values(data?.integrations || {}) as any[];
  const live = integrations.filter((v) => v.status === "live").length;
  return (
    <nav className="flex h-full w-[248px] shrink-0 flex-col border-r border-slate-200/80 bg-white">
      <a href="/" title="SAATHI home" className="flex items-center gap-3 px-5 pb-5 pt-6">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-amber-400 text-[16px] font-black text-white shadow-md shadow-emerald-500/25">स</div>
        <div>
          <div className="text-[15px] font-extrabold tracking-tight text-slate-900">SAATHI AI</div>
          <div className="text-[11px] font-medium text-slate-500">Control Room</div>
        </div>
      </a>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group) => (
          <div key={group}>
            <div className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">{group}</div>
            <div className="space-y-0.5">
              {NAV.filter((n) => n.group === group).map(({ id, label, icon: Icon }) => {
                const active = view === id;
                return (
                  <button key={id} onClick={() => setView(id)}
                    className={clsx("group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition",
                      active ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
                    {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-emerald-500" />}
                    <Icon size={16} className={active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600"} />
                    <span className="flex-1 text-left">{label}</span>
                    {!!badges[id] && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{badges[id]}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="m-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-slate-700">Integrations</span>
          <span className="text-[11px] font-semibold text-emerald-600">{live}/{integrations.length} live</span>
        </div>
        <div className="mt-2.5 grid grid-cols-5 gap-1.5">
          {Object.entries(data?.integrations || {}).map(([key, v]: any) => (
            <div key={key} title={`${INTEGRATION_NAMES[key] || key}: ${v.status} — ${v.detail}`}
              className="flex flex-col items-center gap-1 rounded-lg bg-white py-1.5 shadow-sm">
              <span className={clsx("h-2 w-2 rounded-full", dotFor(v.status), v.status === "live" && "live-dot")} />
              <span className="text-[9px] font-semibold text-slate-500">{(INTEGRATION_NAMES[key] || key).slice(0, 6)}</span>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm lg:flex">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>
      <div className="leading-tight">
        <div className="font-mono text-[13px] font-semibold tabular-nums text-slate-900">{now ? now.toLocaleTimeString("en-IN", { hour12: false }) : "--:--:--"}</div>
        <div className="text-[9.5px] font-semibold uppercase tracking-wider text-emerald-600">Live · IST</div>
      </div>
    </div>
  );
}

export function TopBar({ data, voiceOn, setVoiceOn, mode, setMode, onStart, onStop, onReset, title, hint }: {
  data: any; voiceOn: boolean; setVoiceOn: (v: boolean) => void; mode: "autoplay" | "presenter"; setMode: (m: any) => void;
  onStart: () => void; onStop: () => void; onReset: () => void; title?: string; hint?: string;
}) {
  const running = data?.demo?.status === "running";
  return (
    <header className="flex items-center gap-3 border-b border-slate-200/80 bg-white/85 px-6 py-3.5 backdrop-blur-md md:px-8">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11.5px] font-medium text-slate-400">
          <span>Control Room</span><span>/</span><span className="text-slate-600">{title}</span>
        </div>
        <h1 className="truncate text-[19px] font-bold tracking-tight text-slate-900">{title}</h1>
        {hint && <p className="hidden truncate text-[12.5px] text-slate-500 xl:block">{hint}</p>}
      </div>
      <LiveClock />
      <a href="/app" target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-2 text-xs" title="End-user mobile app (Rahul / Lakshmi)">
        <Smartphone size={15} /> <span className="hidden sm:inline">User app</span>
      </a>
      <button onClick={() => setVoiceOn(!voiceOn)} className={clsx("btn-ghost !px-3 !py-2", voiceOn && "!border-emerald-200 !bg-emerald-50 !text-emerald-700")} title="Sarvam voice playback">
        {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}<span className="hidden text-xs md:inline">{voiceOn ? "Voice on" : "Voice off"}</span>
      </button>
      <div className="hidden rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-[11.5px] font-semibold md:flex">
        {(["autoplay", "presenter"] as const).map((m) => (
          <button key={m} disabled={running} onClick={() => setMode(m)}
            className={clsx("rounded-lg px-2.5 py-1.5 capitalize transition", mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{m}</button>
        ))}
      </div>
      <button onClick={onReset} disabled={running} className="btn-ghost !px-2.5 !py-2" title="Reset demo data"><RotateCcw size={15} /></button>
      {running ? (
        <button onClick={onStop} className="btn-danger px-5"><Square size={14} /> Stop demo</button>
      ) : (
        <button onClick={onStart} className="btn bg-gradient-to-r from-emerald-500 to-amber-400 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-emerald-500/25 hover:brightness-105">
          <Play size={15} fill="currentColor" /> Start live demo
        </button>
      )}
    </header>
  );
}

/** Ops strip: integration health + a live ticker of the latest actions. */
export function StatusStrip({ data }: { data: any }) {
  const items = (data?.activity || []).filter((a: any) => a.kind !== "tool_read").slice(0, 10);
  const latency = data?.integrations?.claude?.latency_ms;
  return (
    <div className="flex items-center gap-4 border-b border-slate-200/80 bg-slate-50/80 px-6 py-2 text-[12px] md:px-8">
      <div className="flex shrink-0 items-center gap-3">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 live-dot" /> Systems operational
        </span>
        {Object.entries(data?.integrations || {}).map(([key, v]: any) => (
          <span key={key} title={v.detail} className="hidden items-center gap-1.5 text-slate-500 xl:flex">
            <span className={clsx("h-1.5 w-1.5 rounded-full", dotFor(v.status))} />{INTEGRATION_NAMES[key] || key}
            {key === "claude" && latency ? <span className="text-slate-400">· {(latency / 1000).toFixed(1)}s</span> : null}
          </span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden marquee-mask">
        {items.length > 0 && (
          <div className="ticker flex w-max gap-8 whitespace-nowrap text-slate-500">
            {[...items, ...items].map((a: any, i: number) => (
              <span key={`${a.log_id}-${i}`}><span className="font-mono text-slate-400">{new Date(a.timestamp).toLocaleTimeString("en-IN", { hour12: false })}</span> · {a.message}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Metrics({ m, setView }: { m: any; setView: (v: string) => void }) {
  if (!m) return null;
  const tiles = [
    { label: "Active calls", value: m.active_calls, view: "calls", alert: m.active_calls > 0, icon: PhoneCall, tint: "bg-rose-50 text-rose-600" },
    { label: "High-risk txns", value: m.high_risk_transactions, view: "fraud", alert: false, icon: ShieldAlert, tint: "bg-orange-50 text-orange-600" },
    { label: "Pending approvals", value: m.pending_approvals, view: "overview", alert: m.pending_approvals > 0, icon: CircleDollarSign, tint: "bg-amber-50 text-amber-600" },
    { label: "Today's sales", value: compactInr(m.todays_sales), sub: pct(m.sales_growth_pct), view: "health", icon: Store, tint: "bg-emerald-50 text-emerald-600" },
    { label: "Inventory alerts", value: m.inventory_alerts, view: "inventory", alert: m.inventory_alerts > 0, icon: Boxes, tint: "bg-sky-50 text-sky-600" },
    { label: "Outstanding credit", value: inr(m.outstanding_credit), view: "credit", icon: HandCoins, tint: "bg-violet-50 text-violet-600" },
    { label: "Predicted failures", value: m.predicted_payment_failures, view: "radar", alert: m.predicted_payment_failures > 0, icon: Radar, tint: "bg-fuchsia-50 text-fuchsia-600" },
    { label: "AI actions", value: m.ai_actions, sub: `${m.executed_actions} approved`, view: "activity", icon: Bot, tint: "bg-teal-50 text-teal-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
      {tiles.map((t) => (
        <button key={t.label} onClick={() => setView(t.view)}
          className={clsx("group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-12px_rgba(15,23,42,.18)]",
            t.alert ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200/80")}>
          <div className="flex items-center justify-between">
            <span className={clsx("grid h-8 w-8 place-items-center rounded-xl", t.tint)}><t.icon size={15} /></span>
            {t.alert && <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-600"><span className="h-1.5 w-1.5 rounded-full bg-amber-500 live-dot" />Live</span>}
          </div>
          <div className="mt-3 text-[22px] font-bold tabular-nums tracking-tight text-slate-900">{t.value}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
            <span className="truncate">{t.label}</span>
            {t.sub && <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-px text-[10.5px] font-semibold text-emerald-700">{t.sub}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
