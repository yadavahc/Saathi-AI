"use client";
import { useEffect, useRef, useState } from "react";
import Console, { Msg } from "@/components/Console";
import { DemoStrip, ImpactModal } from "@/components/Demo";
import { Metrics, NAV, Sidebar, TopBar } from "@/components/Shell";
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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar view={view} setView={setView} data={data} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar data={data} voiceOn={voiceOn} setVoiceOn={setVoiceOn} mode={mode} setMode={setMode}
          onStart={async () => { setRunId(null); setMessages([]); setView("overview"); await api.demoStart(mode); refresh(); }}
          onStop={async () => { await api.demoStop(); refresh(); }}
          onReset={async () => { await api.demoReset(); setMessages([]); setRunId(null); refresh(); }} />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">Backend unreachable — start FastAPI on :8000 ({error})</div>}
            {!data && !error && <div className="text-sm text-slate-500">Connecting to SAATHI…</div>}
            {data && (
              <>
                <Metrics m={data.metrics} setView={setView} />
                <DemoStrip demo={data.demo} onScenario={async (id) => { setRunId(null); await api.demoStart(mode, id); refresh(); }} />
                <div className="flex items-center justify-between">
                  <h1 className="text-lg font-bold text-white">{NAV.find((n) => n.id === view)?.label}</h1>
                  {data.demo?.status === "complete" && <button className="text-xs font-semibold text-brand-300 hover:text-brand-200" onClick={() => setShowImpact(true)}>View impact summary →</button>}
                </div>
                <View {...ctx} />
              </>
            )}
          </main>
          <div className="hidden w-[400px] shrink-0 border-l border-white/[0.06] p-3 lg:block">
            <Console data={data} messages={messages} tab={tab} setTab={setTab} busy={busy} ask={ask} askVoice={askVoice}
              onRefresh={refresh} onApprove={approve} onReject={reject} />
          </div>
        </div>
      </div>
      {showImpact && <ImpactModal demo={data?.demo} onClose={() => setShowImpact(false)} />}
    </div>
  );
}
