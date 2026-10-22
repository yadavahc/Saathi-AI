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
  const last = [...(call.transcript || [])].reverse().find((t: any) => t.speaker === "SAATHI");
  useEffect(() => { if (voiceOn && last?.audio_url) playAudio(last.audio_url); }, [last?.audio_url, voiceOn]);
  async function say(text: string) {
    setBusy(true);
    try { await api.respondCall(call.call_id, text); } finally { setBusy(false); onChange(); }
  }
  const verifying = call.step === "verify";
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[440px] flex-col bg-gradient-to-b from-emerald-900 via-emerald-950 to-stone-950 px-6 pb-10 pt-16 text-white">
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 animate-pulse place-items-center rounded-full bg-white/10 ring-8 ring-white/5">
          <ShieldAlert size={34} className="text-emerald-300" />
        </div>
        <div className="mt-5 text-[13px] font-semibold uppercase tracking-[0.18em] text-emerald-300">SAATHI is calling</div>
        <div className="mt-1 text-[22px] font-bold">Payment safety check</div>
        <div className="mt-1 text-[13px] text-white/60">{call.provider === "vobiz" ? "Also ringing your phone" : "In-app call"} · {call.language}</div>
      </div>
      <div className="mt-10 rounded-3xl bg-white/[0.07] p-5 text-[17px] leading-relaxed">
        {last?.text}
        {last?.audio_url && (
          <button onClick={() => playAudio(last.audio_url, true)} className="mt-3 block text-[13px] font-semibold text-emerald-300">▶ Play again</button>
        )}
      </div>
      <div className="mt-auto space-y-3">
        {verifying ? (
          <>
            <button disabled={busy} onClick={() => say("No, I didn't make it")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 py-4 text-[16px] font-bold active:scale-[.98]">
              <PhoneOff size={18} /> No, it wasn't me
            </button>
            <button disabled={busy} onClick={() => say("Yes, it was me")} className="w-full rounded-2xl bg-white/10 py-4 text-[16px] font-semibold active:scale-[.98]">
              Yes, I made this payment
            </button>
          </>
        ) : (
          <>
            <button disabled={busy} onClick={() => say("Yes, block it")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-[16px] font-bold text-emerald-950 active:scale-[.98]">
              <Phone size={18} /> Yes, block it & report
            </button>
            <button disabled={busy} onClick={() => say("No")} className="w-full rounded-2xl bg-white/10 py-4 text-[16px] font-semibold active:scale-[.98]">
              Don't block
            </button>
          </>
        )}
        <div className="text-center text-[12px] text-white/50">SAATHI will never ask for your OTP, PIN or CVV.</div>
      </div>
    </div>
  );
}
