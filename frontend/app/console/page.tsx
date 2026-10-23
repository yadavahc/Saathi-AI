"use client";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import Console, { Msg } from "@/components/Console";
import { DemoStrip, ImpactModal } from "@/components/Demo";
import { Metrics, NAV, Sidebar, StatusStrip, TopBar } from "@/components/Shell";
import { CallsView, FraudView, RadarView, SOSView } from "@/dashboard/FinanceViews";
import { CampaignsView, CashView, CreditView, HealthView, InventoryView, OrdersView } from "@/dashboard/MerchantViews";
import OverviewView from "@/dashboard/OverviewView";
import { ActivityView, AgentsView } from "@/dashboard/SystemViews";
import { ShieldView, SnapView } from "@/dashboard/WowViews";
import type { Ctx } from "@/dashboard/types";
import { useDashboard } from "@/hooks/useDashboard";
import { playAudio } from "@/hooks/useRecorder";
import { api, Persona } from "@/services/api";

const VIEWS: Record<string, (ctx: Ctx) => JSX.Element | null> = {
  overview: OverviewView, shield: ShieldView, snap: SnapView, calls: CallsView, radar: RadarView, fraud: FraudView, sos: SOSView, health: HealthView, cash: CashView,
  inventory: InventoryView, credit: CreditView, orders: OrdersView, campaigns: CampaignsView, agents: AgentsView, activity: ActivityView,
};

export default function Page() {
  const { data, error, refresh } = useDashboard();
  const [view, setView] = useState("overview");
  const [voiceOn, setVoiceOn] = useState(true);
  const [mode, setMode] = useState<"autoplay" | "presenter">("autoplay");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [tab, setTab] = useState("talk");
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [showImpact, setShowImpact] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const lastDemo = useRef<string>("idle");

  // Open the impact screen when a full demo run completes; follow the live call during demo 1.
  useEffect(() => {
    const status = data?.demo?.status;
    if (status === "complete" && lastDemo.current === "running" && data.demo.scenarios.every((s: any) => s.status !== "pending")) setShowImpact(true);
    if (status === "running" && data.demo.current === 1 && view !== "calls" && view !== "overview") setView("overview");
    if (status === "running" && data.demo.current === 9) setView("shield");
    if (status === "running" && data.demo.current === 10) setView("snap");
    lastDemo.current = status;
  }, [data?.demo?.status, data?.demo?.current]);

  function push(m: Omit<Msg, "ts">) { setMessages((all) => [...all, { ...m, ts: new Date().toISOString() }]); }

  function onResult(r: any) {
    push({ role: "saathi", text: r.reply, meta: r });
    setRunId(r.run_id || null);
    if (voiceOn && r.audio_url) playAudio(r.audio_url, true);
    refresh();
  }

  async function ask(text: string, persona: Persona) {
    if (busy) return;
    setTab("talk");
    setAssistantOpen(true);
    push({ role: "user", text });
    setBusy(true);
    try { onResult(await api.chat(text, persona, voiceOn)); }
    catch (e: any) { push({ role: "system", text: e.message }); }
    finally { setBusy(false); }
  }

  async function askVoice(blob: Blob, persona: Persona) {
    setBusy(true);
    try {
      const r = await api.voice(blob, persona);
      push({ role: "user", text: r.transcript, meta: { voice: true } });
      onResult(r);
    } catch (e: any) { push({ role: "system", text: e.message }); }
    finally { setBusy(false); }
  }

  const approve = async (id: string) => { await api.approve(id).catch(() => undefined); refresh(); };
  const reject = async (id: string) => { await api.reject(id).catch(() => undefined); refresh(); };

  const ctx: Ctx = { data, ask, setView, approve, reject, refresh, voiceOn, runId, setRunId };
  const View = VIEWS[view];

  const nav = NAV.find((n) => n.id === view);
  const pendingCount = (data?.approvals || []).filter((a: any) => a.status === "PENDING").length;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7fb] text-slate-900">
      <Sidebar view={view} setView={setView} data={data} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar data={data} voiceOn={voiceOn} setVoiceOn={setVoiceOn} mode={mode} setMode={setMode} title={nav?.label} hint={nav?.hint}
          onStart={async () => { setRunId(null); setMessages([]); setView("overview"); await api.demoStart(mode); refresh(); }}
          onStop={async () => { await api.demoStop(); refresh(); }}
          onReset={async () => { await api.demoReset(); setMessages([]); setRunId(null); refresh(); }} />
        {data && <StatusStrip data={data} />}
        <main className="ops-grid min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1480px] space-y-6 px-6 py-6 md:px-8 md:py-8">
            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Backend unreachable — start FastAPI on :8000 ({error})</div>}
            {!data && !error && (
              <div className="grid place-items-center py-24 text-sm text-slate-500">
                <span className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />Connecting to SAATHI…
              </div>
            )}
            {data && (
              <>
                {view === "overview" && <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">Key signals</h2>
                    {data.demo?.status === "complete" && (
                      <button className="text-[12.5px] font-semibold text-emerald-700 hover:text-emerald-800" onClick={() => setShowImpact(true)}>View impact summary →</button>
                    )}
                  </div>
                  <Metrics m={data.metrics} setView={setView} />
                </section>}
                {view !== "overview" && data.demo?.status === "complete" && (
                  <div className="flex justify-end"><button className="text-[12.5px] font-semibold text-emerald-700 hover:text-emerald-800" onClick={() => setShowImpact(true)}>View impact summary →</button></div>
                )}
                <DemoStrip demo={data.demo} onScenario={async (id) => { setRunId(null); await api.demoStart(mode, id); refresh(); }} />
                <section key={view} className="animate-slideUp">
                  <View {...ctx} />
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {/* SAATHI assistant: talk, approvals and Telegram live in a slide-over instead of a cramped fixed column */}
      <button onClick={() => setAssistantOpen(true)}
        className={clsx("fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-slate-900 py-3 pl-3 pr-5 text-[14px] font-semibold text-white shadow-2xl shadow-slate-900/30 transition hover:-translate-y-0.5",
          assistantOpen && "pointer-events-none opacity-0")}>
        <span className="relative grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-amber-400 text-[14px] font-black">स
          {pendingCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold ring-2 ring-slate-900">{pendingCount}</span>}
        </span>
        Talk to SAATHI
      </button>
      <div className={clsx("fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px] transition-opacity duration-300", assistantOpen ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={() => setAssistantOpen(false)} />
      <div className={clsx("fixed inset-y-0 right-0 z-50 w-full max-w-[440px] p-3 transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
        assistantOpen ? "translate-x-0" : "translate-x-full")}>
        <Console data={data} messages={messages} tab={tab} setTab={setTab} busy={busy} ask={ask} askVoice={askVoice}
          onRefresh={refresh} onApprove={approve} onReject={reject} onClose={() => setAssistantOpen(false)} />
      </div>
      {showImpact && <ImpactModal demo={data?.demo} onClose={() => setShowImpact(false)} />}
    </div>
  );
}
