"use client";
import clsx from "clsx";
import { Mic, PhoneCall, PhoneOff, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { playAudio, useRecorder } from "@/hooks/useRecorder";
import { api } from "@/services/api";
import { Badge, Empty, Status } from "./ui";

export default function LiveCallPanel({ call, voiceOn, compact = false, onChange }: {
  call: any; voiceOn: boolean; compact?: boolean; onChange?: () => void;
}) {
  const rec = useRecorder();
  const [busy, setBusy] = useState(false);

  // Speak each new SAATHI line as soon as its Sarvam audio is ready.
  useEffect(() => {
    if (!voiceOn || !call || call.status === "COMPLETED") return;
    const last = [...(call.transcript || [])].reverse().find((t: any) => t.speaker === "SAATHI" && t.audio_url);
    if (last) playAudio(last.audio_url);
  }, [call, voiceOn]);

  if (!call) {
    return (
      <Empty>
        No calls yet. When a high-risk transaction appears, SAATHI calls the user and verifies by voice.
        <div className="mt-3">
          <button className="btn-ghost !text-xs" onClick={async () => { await api.injectFraud(); onChange?.(); }}>
            Simulate ₹25,000 fraud attempt
          </button>
        </div>
      </Empty>
    );
  }

  const live = call.status !== "COMPLETED";
  const waiting = live && (call.step === "verify" || call.step === "confirm");

  async function say(text: string) {
    setBusy(true);
    try { await api.respondCall(call.call_id, text); onChange?.(); } finally { setBusy(false); }
  }

  async function toggleMic() {
    if (!rec.recording) return rec.start();
    const blob = await rec.stop();
    if (!blob) return;
    setBusy(true);
    try { await api.callVoice(blob, call.call_id); onChange?.(); } catch { /* fall back to buttons */ } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className={clsx("rounded-2xl border p-4", live ? "border-rose-400/30 bg-gradient-to-br from-rose-500/[0.08] to-transparent" : "border-white/[0.07] bg-white/[0.02]")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={clsx("grid h-9 w-9 place-items-center rounded-full", live ? "bg-rose-500/20 text-rose-300 animate-pulseRing" : "bg-white/5 text-slate-400")}>
              {live ? <PhoneCall size={16} /> : <PhoneOff size={16} />}
            </span>
            <div>
              <div className="label">Live AI call · {call.provider === "vobiz" ? "Vobiz" : "simulated line"}</div>
              <div className="text-sm font-semibold text-white">{call.call_id}</div>
            </div>
          </div>
          <Status value={live ? "CONNECTED" : "COMPLETED"} />
        </div>
        <dl className={clsx("mt-4 grid gap-3 text-[12.5px]", compact ? "grid-cols-2" : "grid-cols-3")}>
          {[["User", call.user], ["Language", call.language], ["Reason", call.reason], ["Risk", call.risk], ["Current step", call.current_step]].map(([k, v]) => (
            <div key={k}>
              <dt className="label !text-[9.5px]">{k}</dt>
              <dd className={clsx("mt-0.5 font-semibold", k === "Risk" ? "text-rose-300" : k === "Current step" && waiting ? "text-amber-300" : "text-slate-100")}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={clsx("space-y-2 overflow-y-auto pr-1", compact ? "max-h-56" : "max-h-[420px]")}>
        {(call.transcript || []).map((t: any, i: number) => (
          <div key={i} className={clsx("flex animate-slideUp", t.speaker === "USER" ? "justify-end" : "justify-start")}>
            <div className={clsx("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
              t.speaker === "USER" ? "rounded-br-sm bg-sky-500/15 text-sky-50" : "rounded-bl-sm bg-white/[0.05] text-slate-100")}>
              <div className="mb-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t.speaker === "USER" ? call.user : "SAATHI"}
                {t.audio_url && (
                  <button className="text-brand-300 hover:text-brand-200" onClick={() => playAudio(t.audio_url, true)} title="Play Sarvam voice">
                    <Play size={11} />
                  </button>
                )}
              </div>
              {t.text}
              {t.speech_text && t.speech_text !== t.text && !compact && <div className="mt-1 text-[12px] text-slate-400">{t.speech_text}</div>}
            </div>
          </div>
        ))}
      </div>

      {waiting && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
          <span className="mr-1 text-xs font-semibold text-amber-200">{call.step === "verify" ? "User answers:" : "Confirm action:"}</span>
          {call.step === "verify" ? (
            <>
              <button disabled={busy} className="btn-danger !py-1.5 !text-xs" onClick={() => say("No, I didn't make it")}>“Illa / No”</button>
              <button disabled={busy} className="btn-ghost !py-1.5 !text-xs" onClick={() => say("Yes, it was me")}>“Howdu / Yes, me”</button>
            </>
          ) : (
            <>
              <button disabled={busy} className="btn-primary !py-1.5 !text-xs" onClick={() => say("Yes, block it")}>“Howdu / Yes”</button>
              <button disabled={busy} className="btn-ghost !py-1.5 !text-xs" onClick={() => say("No")}>“Beda / No”</button>
            </>
          )}
          <button disabled={busy} onClick={toggleMic} className={clsx("btn-ghost ml-auto !py-1.5 !text-xs", rec.recording && "!border-rose-400/60 !text-rose-300")}>
            {rec.recording ? <Square size={12} /> : <Mic size={12} />} {rec.recording ? "Stop" : "Speak"}
          </button>
        </div>
      )}

      {call.tool_results?.length > 0 && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3">
          <div className="label mb-2 !text-emerald-300/80">Backend actions</div>
          {call.tool_results.map((t: any) => (
            <div key={t.name} className="flex items-center justify-between py-0.5 font-mono text-[12px]">
              <span className="text-slate-200">{t.name}</span><Badge tone="green">{t.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
