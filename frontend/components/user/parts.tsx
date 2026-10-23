"use client";
import clsx from "clsx";
import { Check, Phone, PhoneOff, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { playAudio } from "@/hooks/useRecorder";
import { api } from "@/services/api";
import { inr } from "@/services/format";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-3xl border border-stone-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.04)]", className)}>{children}</div>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[15px] font-bold text-stone-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const PILL: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/15",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
  stone: "bg-stone-100 text-stone-600 ring-stone-500/10",
};

export function Pill({ tone = "stone", children }: { tone?: string; children: ReactNode }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", PILL[tone])}>{children}</span>;
}

/** Plain-language status for end users. */
export function friendlyStatus(status: string): { label: string; tone: string } {
  const map: Record<string, { label: string; tone: string }> = {
    EXECUTED: { label: "Done", tone: "green" }, CONFIRMED: { label: "Confirmed", tone: "green" }, COMPLETED: { label: "Completed", tone: "stone" },
    FROZEN: { label: "Blocked", tone: "red" }, FLAGGED: { label: "Checking", tone: "amber" }, PENDING: { label: "Waiting", tone: "amber" },
    AWAITING_THIRD_PARTY: { label: "Waiting for reply", tone: "blue" }, SENT_TO_SUPPLIER: { label: "Sent", tone: "blue" },
    AWAITING_MERCHANT: { label: "Sent", tone: "blue" }, REJECTED: { label: "Declined", tone: "stone" }, FAILED: { label: "Didn't work", tone: "red" },
    LIVE: { label: "Live", tone: "green" }, DRAFT: { label: "Draft", tone: "stone" }, SUBMITTED: { label: "Submitted", tone: "green" },
    OPEN: { label: "Case open", tone: "amber" }, ACTIVE: { label: "Active", tone: "green" }, COUNTER_OFFER: { label: "Counter offer", tone: "amber" },
  };
  return map[status] || { label: status.replace(/_/g, " ").toLowerCase(), tone: "stone" };
}

export function ApprovalTile({ a, onDone }: { a: any; onDone: () => void }) {
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  async function decide(yes: boolean) {
    setBusy(yes ? "yes" : "no");
    try { await (yes ? api.approve(a.approval_id) : api.reject(a.approval_id)); } finally { setBusy(null); onDone(); }
  }
  return (
    <Card className="border-amber-200 bg-gradient-to-b from-amber-50/70 to-white">
      <div className="text-[12px] font-semibold text-amber-700">SAATHI needs your OK</div>
      <div className="mt-1 text-[16px] font-bold leading-snug">{a.description}</div>
      {a.impact && <div className="mt-1.5 text-[13.5px] text-stone-600">{a.impact}</div>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-stone-500">
        {a.amount != null && <span className="font-semibold text-stone-800">{inr(a.amount)}</span>}
        {a.target && <span>· {a.target}</span>}
        {a.simulated && <Pill>Demo mode</Pill>}
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <button disabled={!!busy} onClick={() => decide(false)}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white py-3 text-[14px] font-semibold text-stone-700 active:scale-[.98]">
          {busy === "no" ? "…" : <><X size={16} /> Not now</>}
        </button>
        <button disabled={!!busy} onClick={() => decide(true)}
          className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-3 text-[14px] font-bold text-white shadow-sm shadow-emerald-700/30 active:scale-[.98]">
          {busy === "yes" ? "Working…" : <><Check size={16} /> Approve</>}
        </button>
      </div>
    </Card>
  );
}

/** Full-screen incoming call when SAATHI is verifying a payment with this user. */
export function CallOverlay({ call, voiceOn, onChange }: { call: any; voiceOn: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const last = [...(call.transcript || [])].reverse().find((t: any) => t.speaker === "SAATHI");
  useEffect(() => { if (voiceOn && last?.audio_url) playAudio(last.audio_url); }, [last?.audio_url, voiceOn]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  async function say(text: string) {
    setBusy(true);
    try { await api.respondCall(call.call_id, text); } finally { setBusy(false); onChange(); }
  }
  const verifying = call.step === "verify";
  const secs = call.started_at ? Math.max(0, Math.floor((now - new Date(call.started_at).getTime()) / 1000)) : 0;
  const timer = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const decline = verifying ? { text: "No, I didn't make it", label: "No, it wasn't me" } : { text: "No", label: "Don't block" };
  const accept = verifying ? { text: "Yes, it was me", label: "Yes, it was me" } : { text: "Yes, block it", label: "Block & report" };
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[440px] flex-col overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-sky-50 px-6 pb-10 pt-12 text-stone-900">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="relative text-center">
        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-700">SAATHI is calling</div>
        <div className="mt-1 font-mono text-[14px] tabular-nums text-stone-500">{timer}</div>
        <div className="relative mx-auto mt-8 grid h-36 w-36 place-items-center">
          <span className="ring-wave absolute inset-0 rounded-full bg-emerald-300/50" />
          <span className="ring-wave absolute inset-0 rounded-full bg-emerald-300/40" style={{ animationDelay: ".7s" }} />
          <span className="ring-wave absolute inset-0 rounded-full bg-emerald-300/30" style={{ animationDelay: "1.4s" }} />
          <div className="clay relative grid h-28 w-28 place-items-center !rounded-full bg-gradient-to-br from-emerald-400 to-teal-500">
            <ShieldAlert size={44} className="text-white" />
          </div>
        </div>
        <div className="mt-6 text-[24px] font-extrabold tracking-tight">Payment safety check</div>
        <div className="mt-1 text-[13px] text-stone-500">{call.provider === "vobiz" ? "Also ringing your phone" : "In-app call"} · {call.language}</div>
        <div className="mt-4 flex h-7 items-center justify-center gap-[3px]">
          {Array.from({ length: 20 }).map((_, i) => (
            <span key={i} className="eq-bar w-[3px] rounded-full bg-emerald-500/80" style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 6) * 0.1}s` }} />
          ))}
        </div>
      </div>
      <div className="clay-sm relative mt-6 p-5 text-[16.5px] leading-relaxed text-stone-800">
        {last?.text}
        {last?.audio_url && (
          <button onClick={() => playAudio(last.audio_url, true)} className="mt-3 block text-[13px] font-semibold text-emerald-700">▶ Play again</button>
        )}
      </div>
      <div className="relative mt-auto">
        <div className="flex items-start justify-around">
          <button disabled={busy} onClick={() => say(decline.text)} className="group flex flex-col items-center gap-2">
            <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-rose-500 text-white shadow-xl shadow-rose-500/30 transition group-active:scale-95"><PhoneOff size={28} /></span>
            <span className="text-[13px] font-semibold text-stone-700">{decline.label}</span>
          </button>
          <button disabled={busy} onClick={() => say(accept.text)} className="group flex flex-col items-center gap-2">
            <span className="relative grid h-[72px] w-[72px] place-items-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 transition group-active:scale-95">
              <span className="ring-wave absolute inset-0 rounded-full bg-emerald-400/50" /><Phone size={28} className="ring-shake relative" />
            </span>
            <span className="text-[13px] font-semibold text-stone-700">{accept.label}</span>
          </button>
        </div>
        <div className="mt-6 text-center text-[12px] text-stone-500">SAATHI will never ask for your OTP, PIN or CVV.</div>
      </div>
    </div>
  );
}
