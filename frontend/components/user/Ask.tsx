"use client";
import clsx from "clsx";
import { ArrowUp, Mic, Square, Volume2 } from "lucide-react";
import { useState } from "react";
import { playAudio, useRecorder } from "@/hooks/useRecorder";
import { api, Persona } from "@/services/api";

export type Reply = { you: string; text: string; audio?: string | null; approvals: number } | null;

/** The one place users talk to SAATHI: tap-to-speak or type, in any language. */
export default function Ask({ persona, language, voiceOn, suggestions, reply, setReply, onDone }: {
  persona: Persona; language: string; voiceOn: boolean; suggestions: string[];
  reply: Reply; setReply: (r: Reply) => void; onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRecorder();

  function show(you: string, r: any) {
    setReply({ you, text: r.reply, audio: r.audio_url, approvals: r.approvals?.length || 0 });
    if (voiceOn && r.audio_url) playAudio(r.audio_url, true);
    onDone();
  }

  async function send(value = text) {
    if (!value.trim() || busy) return;
    setText(""); setError(null); setBusy(true);
    setReply({ you: value, text: "", approvals: 0 });
    try { show(value, await api.chat(value, persona, voiceOn, language)); }
    catch (e: any) { setError(e.message); setReply(null); }
    finally { setBusy(false); }
  }

  async function mic() {
    if (!rec.recording) { setError(null); return rec.start(); }
    const blob = await rec.stop();
    if (!blob) return;
    setBusy(true); setReply({ you: "…", text: "", approvals: 0 });
    try { const r = await api.voice(blob, persona); show(r.transcript, r); }
    catch (e: any) { setError(e.message); setReply(null); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-[28px] bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white shadow-lg shadow-emerald-800/20">
      <div className="flex items-center gap-4">
        <button onClick={mic} disabled={busy && !rec.recording} aria-label={rec.recording ? "Stop recording" : "Speak to SAATHI"}
          className={clsx("grid h-16 w-16 shrink-0 place-items-center rounded-full transition active:scale-95",
            rec.recording ? "animate-pulse bg-rose-500 ring-8 ring-rose-400/30" : "bg-white text-emerald-700 ring-8 ring-white/15")}>
          {rec.recording ? <Square size={22} fill="currentColor" /> : <Mic size={26} />}
        </button>
        <div>
          <div className="text-[18px] font-bold leading-tight">{rec.recording ? "Listening… tap to stop" : "Tap and speak"}</div>
          <div className="text-[13px] text-emerald-100">Kannada · Hindi · English · mixed</div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/15 p-1.5 pl-3.5">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="…or type your question" className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-emerald-100/80" />
        <button onClick={() => send()} disabled={busy || !text.trim()} aria-label="Send"
          className="grid h-9 w-9 place-items-center rounded-xl bg-white text-emerald-700 disabled:opacity-40"><ArrowUp size={18} /></button>
      </div>
      {!reply && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-white/25">{s}</button>
          ))}
        </div>
      )}
      {error && <div className="mt-3 rounded-xl bg-rose-500/30 px-3 py-2 text-[13px]">{error}</div>}
      {reply && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-stone-800">
          <div className="text-[12px] font-medium text-stone-400">You: “{reply.you}”</div>
          {reply.text ? (
            <>
              <p className="mt-1.5 text-[15px] leading-relaxed">{reply.text}</p>
              <div className="mt-2.5 flex items-center justify-between">
                {reply.audio ? (
                  <button onClick={() => playAudio(reply.audio, true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700"><Volume2 size={15} /> Listen</button>
                ) : <span />}
                <button onClick={() => setReply(null)} className="text-[12.5px] text-stone-400">Ask something else</button>
              </div>
              {reply.approvals > 0 && (
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">
                  ↓ {reply.approvals} action{reply.approvals > 1 ? "s" : ""} waiting for your OK below
                </div>
              )}
            </>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-[14px] text-stone-500">
              <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" /> SAATHI is checking your numbers…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
