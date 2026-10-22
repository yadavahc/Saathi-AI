"use client";
import clsx from "clsx";
import { Bot, Mic, Send, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { playAudio, useRecorder } from "@/hooks/useRecorder";
import { api, Persona } from "@/services/api";
import { LANG_LABEL, time } from "@/services/format";
import ApprovalCard from "./ApprovalCard";
import { Badge, Empty } from "./ui";

export type Msg = { role: "user" | "saathi" | "system"; text: string; meta?: any; ts: string };

const SUGGESTIONS: { text: string; persona: Persona }[] = [
  { text: "Aaj business hegide?", persona: "merchant" },
  { text: "My sales are down and my rice stock is almost finished.", persona: "merchant" },
  { text: "I need ₹80,000 urgently for a hospital admission.", persona: "consumer" },
  { text: "Will my AutoPay payments go through this week?", persona: "consumer" },
  { text: "Ramesh ge payment reminder kalisu", persona: "merchant" },
  { text: "I need 20 notebooks and 10 pens tomorrow under ₹2,000.", persona: "consumer" },
  { text: "Galla mein ₹500 kam hai, reconcile karo", persona: "merchant" },
];

export default function Console({ data, messages, tab, setTab, busy, ask, askVoice, onRefresh, onApprove, onReject }: {
  data: any; messages: Msg[]; tab: string; setTab: (t: string) => void; busy: boolean;
  ask: (text: string, persona: Persona) => void; askVoice: (blob: Blob, persona: Persona) => void;
  onRefresh: () => void; onApprove: (id: string) => void; onReject: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [persona, setPersona] = useState<Persona>("auto");
  const rec = useRecorder();
  const scroller = useRef<HTMLDivElement>(null);
  const pending = (data?.approvals || []).filter((a: any) => a.status === "PENDING");
  const outbox = data?.outbox || [];

  useEffect(() => { scroller.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [messages, busy]);

  function send(value = text, p = persona) {
    if (!value.trim() || busy) return;
    setText("");
    ask(value, p);
  }

  async function toggleMic() {
    if (!rec.recording) return rec.start();
    const blob = await rec.stop();
    if (blob) askVoice(blob, persona);
  }

  const tabs = [
    { id: "talk", label: "Talk to SAATHI" },
    { id: "approvals", label: "Approvals", count: pending.length },
    { id: "telegram", label: "Telegram", count: outbox.filter((o: any) => o.buttons?.length).length },
  ];

  return (
    <aside className="panel flex h-full min-h-0 flex-col">
      <div className="flex gap-1 border-b border-white/[0.06] p-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12px] font-semibold transition",
              tab === t.id ? "bg-white/[0.07] text-white" : "text-slate-400 hover:text-slate-200")}>
            {t.label}
            {!!t.count && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-ink-950">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "talk" && (
        <>
          <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[13px] text-slate-300">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-white"><Bot size={15} className="text-brand-400" /> Namaskara! I'm SAATHI.</div>
                  Speak or type in English, Hindi, Kannada, Tamil, Telugu, Marathi, Bengali or code-mixed. I'll understand, check the data, recommend — and act once you approve.
                </div>
                <div className="label">Try</div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.text} onClick={() => send(s.text, s.persona)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-[12px] text-slate-300 hover:border-brand-400/40 hover:text-white">
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={clsx("flex animate-slideUp", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={clsx("max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                  m.role === "user" ? "rounded-br-sm bg-sky-500/15 text-sky-50" : m.role === "system" ? "bg-rose-500/10 text-rose-200" : "rounded-bl-sm bg-white/[0.05] text-slate-100")}>
                  {m.role === "saathi" && m.meta && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1">
                      {(m.meta.agents || []).map((a: any) => <Badge key={a.agent} tone="green">{a.name}</Badge>)}
                      {m.meta.language && <Badge tone="slate">{LANG_LABEL[m.meta.language] || m.meta.language}</Badge>}
                      <Badge tone={m.meta.engine === "claude" ? "violet" : "slate"}>{m.meta.engine === "claude" ? "Claude" : m.meta.engine}</Badge>
                      {m.meta.audio_url && <button onClick={() => playAudio(m.meta.audio_url, true)} className="text-brand-300"><Volume2 size={13} /></button>}
                    </div>
                  )}
                  {m.meta?.voice && <span className="mr-1 text-[10px] font-bold uppercase text-sky-300">🎙 voice</span>}
                  {m.text}
                  {m.role === "saathi" && m.meta?.approvals?.length > 0 && (
                    <div className="mt-2.5 space-y-2">
                      {m.meta.approvals.map((a: any) => {
                        const live = (data?.approvals || []).find((x: any) => x.approval_id === a.approval_id) || a;
                        return <ApprovalCard key={a.approval_id} a={live} onApprove={onApprove} onReject={onReject} />;
                      })}
                    </div>
                  )}
                  {m.role === "saathi" && m.meta?.agents?.some((a: any) => a.suggested_actions?.length) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.meta.agents.flatMap((a: any) => a.suggested_actions || []).map((s: any) => (
                        <button key={s.label} className="rounded-full border border-brand-400/30 px-2.5 py-1 text-[11px] font-semibold text-brand-200 hover:bg-brand-400/10"
                          onClick={() => send({ inventory_check: "Rice stock check maadi", growth_campaign: "Evening sales are down — suggest a campaign",
                            customer_reminder: "Ramesh ge payment reminder kalisu", cash_reconcile: "Reconcile today's cash" }[s.intent as string] || s.label, "merchant")}>
                          {s.label} →
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 text-right text-[9.5px] text-slate-500">{time(m.ts)}</div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-[12px] text-slate-400">
                <span className="h-2 w-2 animate-ping rounded-full bg-brand-400" /> SAATHI is understanding, retrieving data and reasoning…
              </div>
            )}
          </div>
          <div className="border-t border-white/[0.06] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-500">As</span>
              {(["auto", "consumer", "merchant"] as Persona[]).map((p) => (
                <button key={p} onClick={() => setPersona(p)}
                  className={clsx("rounded-full px-2.5 py-0.5 font-semibold capitalize", persona === p ? "bg-brand-400/20 text-brand-200" : "text-slate-400 hover:text-slate-200")}>{p}</button>
              ))}
              {rec.error && <span className="ml-auto text-rose-300">{rec.error}</span>}
            </div>
            <div className="flex items-end gap-2">
              <button onClick={toggleMic} disabled={busy && !rec.recording} title="Speak (Sarvam STT, auto language)"
                className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition",
                  rec.recording ? "animate-pulseRing border-rose-400/60 bg-rose-500/20 text-rose-200" : "border-white/10 bg-white/[0.04] text-slate-300 hover:text-white")}>
                {rec.recording ? <Square size={15} /> : <Mic size={16} />}
              </button>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Ask in any language…"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-slate-500 focus:border-brand-400/50" />
              <button onClick={() => send()} disabled={busy || !text.trim()} className="btn-primary h-10 w-10 !p-0"><Send size={15} /></button>
            </div>
          </div>
        </>
      )}

      {tab === "approvals" && (
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
          <div className="text-[12px] text-slate-400">Sensitive actions never run without explicit approval. Approve here, by voice, or from the Telegram buttons.</div>
          {(data?.approvals || []).length === 0 && <Empty>No approvals yet.</Empty>}
          {(data?.approvals || []).map((a: any) => <ApprovalCard key={a.approval_id} a={a} onApprove={onApprove} onReject={onReject} />)}
        </div>
      )}

      {tab === "telegram" && (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#0e1621] p-4">
          <div className="flex items-center justify-between text-[11.5px] text-slate-400">
            <span>Telegram action layer {data?.integrations?.telegram?.bot && <>· @{data.integrations.telegram.bot}</>}</span>
            <Badge tone={data?.integrations?.telegram?.status === "live" ? "green" : "amber"}>{data?.integrations?.telegram?.status}</Badge>
          </div>
          {outbox.length === 0 && <Empty>Purchase orders, reminders, alerts and approvals appear here as they're sent.</Empty>}
          {outbox.map((m: any) => (
            <div key={m.message_id} className="animate-slideUp rounded-2xl rounded-tl-sm bg-[#182533] p-3 text-[12.5px] text-slate-100 shadow">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider">
                <span className="text-sky-300">→ {m.role}</span>
                <span className={m.delivered ? "text-emerald-300" : m.will_deliver ? "text-sky-300" : "text-amber-300"}>
                  {m.delivered ? "✓✓ delivered" : m.will_deliver ? "sending…" : "dashboard only"}
                </span>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: m.text.replace(/</g, "&lt;").replace(/&lt;(\/?)(b|i)>/g, "<$1$2>") }} />
              {m.buttons?.length > 0 && (
                <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${m.buttons.length}, minmax(0,1fr))` }}>
                  {m.buttons.map((b: any) => (
                    <button key={b.data} onClick={async () => { await api.telegramPress(b.data); onRefresh(); }}
                      className="rounded-lg bg-[#2b5278] px-2 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#346394]">{b.label}</button>
                  ))}
                </div>
              )}
              {m.response && <div className="mt-1.5 text-[11px] text-emerald-300">↳ {m.response}</div>}
              <div className="mt-1 text-right text-[9.5px] text-slate-500">{time(m.timestamp)}</div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
