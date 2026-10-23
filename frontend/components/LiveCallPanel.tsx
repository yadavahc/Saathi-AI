"use client";
import clsx from "clsx";
import { Grid3x3, Mic, MicOff, Phone, PhoneCall, PhoneOff, Play, ShieldAlert, Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { playAudio, useRecorder } from "@/hooks/useRecorder";
import { api } from "@/services/api";
import { Badge, Empty } from "./ui";

function useCallTimer(start?: string, end?: string, live?: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);
  if (!start) return "00:00";
  const stop = end ? new Date(end).getTime() : now;
  const secs = Math.max(0, Math.floor((stop - new Date(start).getTime()) / 1000));
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-8 items-center justify-center gap-[3px]">
      {Array.from({ length: 22 }).map((_, i) => (
        <span key={i} className={clsx("w-[3px] rounded-full bg-emerald-500/80", active ? "eq-bar" : "")}
          style={{ height: active ? `${30 + ((i * 41) % 70)}%` : "18%", animationDelay: `${(i % 7) * 0.09}s` }} />
      ))}
    </div>
  );
}

function RoundButton({ icon: Icon, label, onClick, active, disabled }: { icon: any; label: string; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="group flex flex-col items-center gap-1.5 disabled:opacity-40">
      <span className={clsx("grid h-12 w-12 place-items-center rounded-full border shadow-sm transition group-active:scale-95",
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 group-hover:bg-slate-50")}>
        <Icon size={18} />
      </span>
      <span className="text-[10.5px] font-medium text-slate-500">{label}</span>
    </button>
  );
}

export default function LiveCallPanel({ call, voiceOn, compact = false, onChange }: {
  call: any; voiceOn: boolean; compact?: boolean; onChange?: () => void;
}) {
  const rec = useRecorder();
  const [busy, setBusy] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const live = !!call && call.status !== "COMPLETED";
  const timer = useCallTimer(call?.started_at, call?.ended_at, live);

  // Speak each new SAATHI line as soon as its Sarvam audio is ready.
  useEffect(() => {
    if (!voiceOn || !call || call.status === "COMPLETED") return;
    const last = [...(call.transcript || [])].reverse().find((t: any) => t.speaker === "SAATHI" && t.audio_url);
    if (last) playAudio(last.audio_url);
  }, [call, voiceOn]);

  if (!call) {
    return (
      <Empty>
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white text-slate-400 shadow-sm"><Phone size={22} /></div>
        No calls yet. When a high-risk transaction appears, SAATHI calls the user and verifies by voice.
        <div className="mt-4">
          <button className="btn-ghost !text-xs" onClick={async () => { await api.injectFraud(); onChange?.(); }}>
            Simulate ₹25,000 fraud attempt
          </button>
        </div>
      </Empty>
    );
  }

  const waiting = live && (call.step === "verify" || call.step === "confirm");
  const ringing = call.status === "RINGING";
  const lastSaathi = [...(call.transcript || [])].reverse().find((t: any) => t.speaker === "SAATHI");

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

  const answers = call.step === "verify"
    ? { yes: { label: "Howdu — it was me", text: "Yes, it was me" }, no: { label: "Illa — not me", text: "No, I didn't make it" } }
    : { yes: { label: "Howdu — block it", text: "Yes, block it" }, no: { label: "Beda — don't", text: "No" } };

  const phone = (
    <div className={clsx("relative overflow-hidden rounded-[28px] border p-5 transition-colors duration-700",
      live ? "border-emerald-200 bg-gradient-to-b from-emerald-50 via-white to-white" : "border-slate-200 bg-gradient-to-b from-slate-50 to-white")}>
      <div className="flex items-center justify-between text-[11.5px] font-medium">
        <span className="flex items-center gap-1.5 text-slate-500">
          {live ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 live-dot" /> : <PhoneOff size={12} />}
          {call.provider === "vobiz" ? "Vobiz phone line" : "SAATHI secure line"}
        </span>
        <span className="font-mono tabular-nums text-slate-700">{ringing ? "Ringing…" : timer}</span>
      </div>

      <div className="mt-5 flex flex-col items-center text-center">
        <div className="relative grid h-24 w-24 place-items-center">
          {live && <>
            <span className="ring-wave absolute inset-0 rounded-full bg-emerald-400/30" />
            <span className="ring-wave absolute inset-0 rounded-full bg-emerald-400/25" style={{ animationDelay: ".7s" }} />
            <span className="ring-wave absolute inset-0 rounded-full bg-emerald-400/20" style={{ animationDelay: "1.4s" }} />
          </>}
          <div className={clsx("relative grid h-20 w-20 place-items-center rounded-full text-[28px] font-bold text-white shadow-lg",
            live ? "bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/30" : "bg-gradient-to-br from-slate-300 to-slate-400")}>
            {(call.user || "?")[0]}
          </div>
          {ringing && <span className="ring-shake absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-white text-emerald-600 shadow"><PhoneCall size={15} /></span>}
        </div>
        <div className="mt-3 text-[18px] font-bold text-slate-900">{call.user}</div>
        <div className="text-[12.5px] text-slate-500">{call.language} · {call.call_id}</div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <Badge tone="red"><ShieldAlert size={11} /> {call.reason}</Badge>
          <Badge tone="red">Risk {call.risk}</Badge>
        </div>
        <div className="mt-3 w-full"><Waveform active={live && !waiting} /></div>
        <div className={clsx("mt-1 rounded-full px-3 py-1 text-[11.5px] font-semibold",
          waiting ? "bg-amber-50 text-amber-700" : live ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
          {call.current_step}
        </div>
      </div>

      {!compact && lastSaathi && (
        <div className="mt-4 rounded-2xl bg-slate-50 px-3.5 py-2.5 text-center text-[13px] leading-relaxed text-slate-700">“{lastSaathi.text}”</div>
      )}

      {waiting && (
        <>
          <div className="mt-5 grid grid-cols-4 gap-2">
            <RoundButton icon={rec.recording ? MicOff : Mic} label={rec.recording ? "Stop" : "Speak"} onClick={toggleMic} active={rec.recording} disabled={busy && !rec.recording} />
            <RoundButton icon={Grid3x3} label="Keypad" onClick={() => setKeypad(!keypad)} active={keypad} />
            <RoundButton icon={Volume2} label="Replay" onClick={() => playAudio(lastSaathi?.audio_url, true)} disabled={!lastSaathi?.audio_url} />
            <RoundButton icon={rec.recording ? Square : Play} label="Voice" onClick={() => playAudio(lastSaathi?.audio_url, true)} disabled={!lastSaathi?.audio_url} />
          </div>
          {keypad && (
            <div className="mt-3 grid grid-cols-2 gap-2 animate-slideUp">
              <button disabled={busy} onClick={() => say(answers.yes.text)} className="rounded-2xl border border-slate-200 bg-white py-2.5 text-[13px] font-semibold text-slate-700 shadow-sm">
                <span className="mr-1.5 font-mono text-[15px] text-slate-900">1</span>{answers.yes.label}</button>
              <button disabled={busy} onClick={() => say(answers.no.text)} className="rounded-2xl border border-slate-200 bg-white py-2.5 text-[13px] font-semibold text-slate-700 shadow-sm">
                <span className="mr-1.5 font-mono text-[15px] text-slate-900">2</span>{answers.no.label}</button>
            </div>
          )}
          <div className="mt-5 flex items-start justify-center gap-10">
            <button disabled={busy} onClick={() => say(answers.no.text)} className="group flex flex-col items-center gap-1.5">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/30 transition group-hover:scale-105 group-active:scale-95"><PhoneOff size={22} /></span>
              <span className="text-[11.5px] font-semibold text-slate-600">{answers.no.label}</span>
            </button>
            <button disabled={busy} onClick={() => say(answers.yes.text)} className="group flex flex-col items-center gap-1.5">
              <span className="relative grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition group-hover:scale-105 group-active:scale-95">
                <span className="ring-wave absolute inset-0 rounded-full bg-emerald-400/40" /><Phone size={22} className="relative" />
              </span>
              <span className="text-[11.5px] font-semibold text-slate-600">{answers.yes.label}</span>
            </button>
          </div>
        </>
      )}
      {!live && <div className="mt-4 text-center text-[12px] font-medium text-slate-500">Call ended · {timer}</div>}
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-3">
        {phone}
        {call.tool_results?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {call.tool_results.map((t: any) => <Badge key={t.name} tone="green">✓ {t.name}</Badge>)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      {phone}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-[13px] font-semibold text-slate-800">Conversation</span>
            <span className="text-[11.5px] text-slate-500">Sarvam voice · Kannada</span>
          </div>
          <div className="max-h-[440px] space-y-2.5 overflow-y-auto p-4">
            {(call.transcript || []).map((t: any, i: number) => (
              <div key={i} className={clsx("flex animate-slideUp", t.speaker === "USER" ? "justify-end" : "justify-start")}>
                <div className={clsx("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                  t.speaker === "USER" ? "rounded-br-md bg-sky-500 text-white" : "rounded-bl-md bg-slate-100 text-slate-800")}>
                  <div className={clsx("mb-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider", t.speaker === "USER" ? "text-sky-100" : "text-slate-500")}>
                    {t.speaker === "USER" ? call.user : "SAATHI"}
                    {t.audio_url && (
                      <button className="text-emerald-600 hover:text-emerald-700" onClick={() => playAudio(t.audio_url, true)} title="Play Sarvam voice">
                        <Play size={11} />
                      </button>
                    )}
                  </div>
                  {t.text}
                  {t.speech_text && t.speech_text !== t.text && <div className="mt-1 text-[12px] text-slate-500">{t.speech_text}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
        {call.tool_results?.length > 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="label mb-2 !text-emerald-700">Backend actions · verified</div>
            {call.tool_results.map((t: any) => (
              <div key={t.name} className="flex items-center justify-between py-1 font-mono text-[12.5px]">
                <span className="text-slate-700">{t.name}</span><Badge tone="green">{t.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
