"use client";
import clsx from "clsx";
import { Mic, PhoneCall, PlayCircle, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useShieldAudio, useShieldMic } from "@/hooks/useShield";
import { api } from "@/services/api";
import { ApprovalTile, Card } from "./parts";

const TONE = {
  SAFE: { ring: "text-emerald-500", bg: "from-emerald-50 via-white to-white", label: "No red flags", chip: "bg-emerald-100 text-emerald-800" },
  SUSPICIOUS: { ring: "text-amber-500", bg: "from-amber-50 via-white to-white", label: "Suspicious", chip: "bg-amber-100 text-amber-800" },
  SCAM: { ring: "text-rose-500", bg: "from-rose-100 via-rose-50 to-white", label: "SCAM CALL", chip: "bg-rose-500 text-white" },
} as const;

/** Entry card on Rahul's home screen. */
export function ShieldCard({ phoneReady, onOpen }: { phoneReady: boolean; onOpen: (source: "simulation" | "mic" | "phone", scenario?: string) => void }) {
  return (
    <Card className="!p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600"><ShieldAlert size={22} /></span>
        <div>
          <div className="text-[16px] font-bold">Scam Shield</div>
          <div className="text-[13px] text-stone-500">On a suspicious call? Let SAATHI listen and warn you.</div>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {phoneReady && (
          <button onClick={() => onOpen("phone")} className="flex items-center justify-center gap-2 rounded-2xl bg-stone-900 py-3 text-[14px] font-semibold text-white active:scale-[.98]">
            <PhoneCall size={16} /> Protect a phone call
          </button>
        )}
        <button onClick={() => onOpen("mic")} className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white py-3 text-[14px] font-semibold text-stone-800 active:scale-[.98]">
          <Mic size={16} /> Listen on speakerphone
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onOpen("simulation", "digital_arrest")} className="flex items-center justify-center gap-1.5 rounded-2xl bg-rose-50 py-2.5 text-[12.5px] font-semibold text-rose-700">
            <PlayCircle size={15} /> Demo: scam call
          </button>
          <button onClick={() => onOpen("simulation", "safe_call")} className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 py-2.5 text-[12.5px] font-semibold text-emerald-700">
            <PlayCircle size={15} /> Demo: genuine call
          </button>
        </div>
      </div>
    </Card>
  );
}

/** Full-screen live view while SAATHI listens to a call. */
export function ShieldScreen({ session, pending, voiceOn, onClose, onChange }: {
  session: any; pending: any[]; voiceOn: boolean; onClose: () => void; onChange: () => void;
}) {
  const live = session.status === "LISTENING";
  const tone = TONE[session.verdict as keyof typeof TONE] || TONE.SAFE;
  const mic = useShieldMic(session.session_id, live && session.source === "mic");
  const [ending, setEnding] = useState(false);
  useShieldAudio(session, voiceOn);
  const warning = (session.warnings || []).slice(-1)[0];
  const mine = (session.approval_ids || []).map((id: string) => pending.find((a) => a.approval_id === id)).filter(Boolean);

  async function stop() {
    setEnding(true);
    try { await api.shieldEnd(session.session_id); } finally { setEnding(false); onChange(); }
  }

  return (
    <div className={clsx("fixed inset-0 z-50 mx-auto flex max-w-[440px] flex-col overflow-y-auto bg-gradient-to-b px-5 pb-8 pt-6 text-stone-900 transition-colors duration-700", tone.bg)}>
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-stone-500">
          SAATHI Scam Shield · {session.source === "phone" ? "phone call" : session.source === "mic" ? "speakerphone" : "demo call"}
        </div>
        <button onClick={live ? stop : onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm"><X size={17} /></button>
      </div>

      <div className="mt-6 flex items-center gap-5">
        <div className="relative grid h-28 w-28 shrink-0 place-items-center">
          <svg viewBox="0 0 100 100" className={clsx("absolute inset-0 -rotate-90", tone.ring)}>
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(15,23,42,.08)" strokeWidth="9" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={`${(session.risk / 100) * 276} 276`} className="transition-all duration-700" />
          </svg>
          <div className="text-center">
            <div className="text-[30px] font-extrabold tabular-nums leading-none">{session.risk}</div>
            <div className="text-[10px] text-stone-500">risk / 100</div>
          </div>
        </div>
        <div>
          <div className={clsx("inline-flex rounded-full px-3 py-1 text-[13px] font-bold", tone.chip)}>{tone.label}</div>
          <div className="mt-2 text-[15px] font-semibold">{session.caller}</div>
          <div className="text-[12.5px] text-stone-500">
            {live ? (session.source === "phone" ? `Call: ${session.stream || "connecting"}` : "Listening…") : "Call ended"}
            {session.source === "mic" && live && ` · ${mic.heard} clips heard`}
          </div>
          {mic.error && <div className="mt-1 text-[12px] text-rose-600">{mic.error}</div>}
        </div>
      </div>

      {warning && (
        <div className={clsx("mt-5 rounded-3xl p-4", warning.level === "SCAM" ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30" : "bg-amber-300 text-amber-950")}>
          <div className="text-[16px] font-bold leading-snug">{warning.text}</div>
          <div className="mt-1.5 text-[13px] opacity-85">{warning.english}</div>
        </div>
      )}

      {session.signals?.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-stone-500">Red flags</div>
          <div className="flex flex-wrap gap-1.5">
            {session.signals.map((s: any) => (
              <span key={s.id} className="animate-slideUp rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-rose-700 shadow-sm ring-1 ring-rose-100">🚩 {s.label}</span>
            ))}
          </div>
        </div>
      )}

      {session.ai?.explanation && (
        <div className="mt-4 rounded-2xl bg-white p-3.5 text-[13.5px] leading-relaxed text-stone-700 shadow-sm">
          <span className="mr-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-400">Why</span>{session.ai.explanation}
        </div>
      )}

      <div className="mt-5 space-y-2">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-stone-500">What SAATHI hears</div>
        {(session.transcript || []).length === 0 && <div className="text-[13.5px] text-stone-500">Waiting for the call audio…</div>}
        {(session.transcript || []).slice(-6).map((t: any, i: number) => (
          <div key={i} className={clsx("animate-slideUp rounded-2xl px-3.5 py-2.5 text-[14px]", t.speaker === "USER" ? "ml-8 bg-sky-500 text-white" : "mr-8 bg-white text-stone-800 shadow-sm")}>
            <div className="text-[10.5px] font-bold uppercase tracking-wider opacity-60">{t.speaker === "USER" ? "You" : "Caller"}</div>
            {t.text}
          </div>
        ))}
      </div>

      {mine.length > 0 && (
        <div className="mt-5 space-y-3 text-stone-900">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-stone-500">Protect yourself</div>
          {mine.map((a) => <ApprovalTile key={a.approval_id} a={a} onDone={onChange} />)}
        </div>
      )}

      <div className="mt-auto pt-6">
        {live ? (
          <button onClick={stop} disabled={ending} className="w-full rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-stone-800 shadow-sm">Stop listening</button>
        ) : (
          <button onClick={onClose} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 py-3.5 text-[15px] font-bold text-white">
            <ShieldCheck size={17} /> Done
          </button>
        )}
      </div>
    </div>
  );
}
