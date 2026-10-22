"use client";
import clsx from "clsx";
import {
  Activity, Bot, Boxes, CircleDollarSign, HandCoins, LayoutDashboard, Megaphone, PhoneCall, Play, Radar, RotateCcw,
  ShieldAlert, ShoppingCart, Siren, Smartphone, Square, Store, Volume2, VolumeX, Wallet,
} from "lucide-react";
import { compactInr, inr, pct } from "@/services/format";

export const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "calls", label: "Live Calls", icon: PhoneCall },
  { id: "radar", label: "Financial Radar", icon: Radar },
  { id: "fraud", label: "Fraud", icon: ShieldAlert },
  { id: "sos", label: "Money SOS", icon: Siren },
  { id: "health", label: "Merchant Health", icon: Store },
  { id: "cash", label: "Cash Reconciliation", icon: Wallet },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "credit", label: "Customer Credit", icon: HandCoins },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "agents", label: "AI Agents", icon: Bot },
  { id: "activity", label: "Activity Log", icon: Activity },
];

const INTEGRATION_NAMES: Record<string, string> = { claude: "Claude", sarvam: "Sarvam", vobiz: "Vobiz", telegram: "Telegram", sheets: "Sheets" };

export function Sidebar({ view, setView, data }: { view: string; setView: (v: string) => void; data: any }) {
  const badges: Record<string, number> = {
    calls: data?.metrics?.active_calls || 0,
    radar: (data?.radar || []).filter((r: any) => r.level === "HIGH").length,
  };
  return (
    <nav className="flex h-full w-[232px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-950/70 px-3 py-4">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-saffron-500 text-[15px] font-black text-ink-950">स</div>
        <div>
          <div className="text-[15px] font-extrabold tracking-wide text-white">SAATHI AI</div>
          <div className="text-[10px] font-medium text-slate-500">Action Agent</div>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setView(id)}
            className={clsx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
              view === id ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200")}>
            <Icon size={15} className={view === id ? "text-brand-400" : ""} />
            <span className="flex-1 text-left">{label}</span>
            {!!badges[id] && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{badges[id]}</span>}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="label mb-1">Integrations</div>
        {Object.entries(data?.integrations || {}).map(([key, v]: any) => (
          <div key={key} className="flex items-center justify-between text-[11.5px]" title={v.detail}>
            <span className="text-slate-300">{INTEGRATION_NAMES[key] || key}</span>
            <span className={clsx("flex items-center gap-1.5 font-semibold capitalize",
              v.status === "live" ? "text-emerald-300" : v.status === "waiting" ? "text-amber-300" : "text-slate-500")}>
              <span className={clsx("h-1.5 w-1.5 rounded-full", v.status === "live" ? "bg-emerald-400" : v.status === "waiting" ? "bg-amber-400" : "bg-slate-500")} />
              {v.status}
            </span>
          </div>
        ))}
      </div>
    </nav>
  );
}

export function TopBar({ data, voiceOn, setVoiceOn, mode, setMode, onStart, onStop, onReset }: {
  data: any; voiceOn: boolean; setVoiceOn: (v: boolean) => void; mode: "autoplay" | "presenter"; setMode: (m: any) => void;
  onStart: () => void; onStop: () => void; onReset: () => void;
}) {
  const running = data?.demo?.status === "running";
  return (
    <header className="flex items-center gap-4 border-b border-white/[0.06] px-6 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] font-bold tracking-tight text-white">Don't just tell me what happened. <span className="text-brand-300">Help me fix it.</span></div>
        <div className="text-[11.5px] text-slate-500">Understand → Analyze → Reason → Recommend → Approve → Act → Verify → Inform</div>
      </div>
      <a href="/app" target="_blank" rel="noreferrer" className="btn-ghost !px-2.5 !py-2 text-xs" title="End-user mobile app (Rahul / Lakshmi)">
        <Smartphone size={15} /> User app
      </a>
      <button onClick={() => setVoiceOn(!voiceOn)} className="btn-ghost !px-2.5 !py-2" title="Sarvam voice playback">
        {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}<span className="text-xs">{voiceOn ? "Voice on" : "Voice off"}</span>
      </button>
      <div className="flex rounded-xl border border-white/10 p-0.5 text-[11.5px] font-semibold">
        {(["autoplay", "presenter"] as const).map((m) => (
          <button key={m} disabled={running} onClick={() => setMode(m)}
            className={clsx("rounded-lg px-2.5 py-1.5 capitalize", mode === m ? "bg-white/10 text-white" : "text-slate-400")}>{m}</button>
        ))}
      </div>
      <button onClick={onReset} disabled={running} className="btn-ghost !px-2.5" title="Reset demo data"><RotateCcw size={15} /></button>
      {running ? (
        <button onClick={onStop} className="btn-danger px-5"><Square size={14} /> STOP DEMO</button>
      ) : (
        <button onClick={onStart} className="btn bg-gradient-to-r from-brand-400 to-saffron-400 px-5 py-2.5 text-[13px] font-extrabold tracking-wide text-ink-950 shadow-[0_0_30px_-6px_rgba(63,208,166,.7)] hover:brightness-110">
          <Play size={15} fill="currentColor" /> START LIVE DEMO
        </button>
      )}
    </header>
  );
}

export function Metrics({ m, setView }: { m: any; setView: (v: string) => void }) {
  if (!m) return null;
  const tiles = [
    { label: "Active Calls", value: m.active_calls, view: "calls", alert: m.active_calls > 0, icon: PhoneCall },
    { label: "High-Risk Txns", value: m.high_risk_transactions, view: "fraud", alert: false, icon: ShieldAlert },
    { label: "Pending Approvals", value: m.pending_approvals, view: "overview", alert: m.pending_approvals > 0, icon: CircleDollarSign },
    { label: "Today's Sales", value: compactInr(m.todays_sales), sub: pct(m.sales_growth_pct), view: "health", icon: Store },
    { label: "Inventory Alerts", value: m.inventory_alerts, view: "inventory", alert: m.inventory_alerts > 0, icon: Boxes },
    { label: "Outstanding Credit", value: inr(m.outstanding_credit), view: "credit", icon: HandCoins },
    { label: "Predicted Failures", value: m.predicted_payment_failures, view: "radar", alert: m.predicted_payment_failures > 0, icon: Radar },
    { label: "AI Actions", value: m.ai_actions, sub: `${m.executed_actions} approved`, view: "activity", icon: Bot },
  ];
  return (
    <div className="grid grid-cols-4 gap-2.5 xl:grid-cols-8">
      {tiles.map((t) => (
        <button key={t.label} onClick={() => setView(t.view)}
          className={clsx("rounded-xl border px-3.5 py-3 text-left transition hover:bg-white/[0.04]",
            t.alert ? "border-amber-400/30 bg-amber-400/[0.04]" : "border-white/[0.06] bg-white/[0.02]")}>
          <div className="flex items-center justify-between">
            <span className="label !text-[9.5px]">{t.label}</span>
            <t.icon size={13} className={t.alert ? "text-amber-300" : "text-slate-600"} />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tabular-nums text-white">{t.value}</span>
            {t.sub && <span className="text-[11px] font-semibold text-emerald-300">{t.sub}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
