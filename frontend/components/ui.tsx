"use client";
import clsx from "clsx";
import type { ReactNode } from "react";

export function Panel({ title, icon, right, children, className, bodyClass }: {
  title?: ReactNode; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={clsx("panel", className)}>
      {title && (
        <header className="panel-head">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            {icon && <span className="text-brand-400">{icon}</span>}
            {title}
          </div>
          {right}
        </header>
      )}
      <div className={clsx("p-5", bodyClass)}>{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  red: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  blue: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  slate: "border-slate-400/20 bg-slate-400/10 text-slate-300",
};

export function Badge({ tone = "slate", children, className }: { tone?: keyof typeof TONES | string; children: ReactNode; className?: string }) {
  return <span className={clsx("chip", TONES[tone] || TONES.slate, className)}>{children}</span>;
}

export function statusTone(status?: string): string {
  const s = (status || "").toUpperCase();
  if (["EXECUTED", "SUCCESS", "CONFIRMED", "COMPLETED", "LIVE", "RECONCILED", "SUBMITTED", "REMINDER SENT", "LOW", "HEALTHY", "OK", "ACTIVE", "OPEN", "VERIFIED", "LIVE_OK"].includes(s)) return "green";
  if (["PENDING", "AWAITING_THIRD_PARTY", "AWAITING_APPROVAL", "SENT_TO_SUPPLIER", "AWAITING_MERCHANT", "MEDIUM", "WATCH", "DRAFT", "RUNNING", "FLAGGED", "COUNTER_OFFER", "WAITING", "RINGING", "CONNECTED"].includes(s)) return "amber";
  if (["FAILED", "ERROR", "REJECTED", "HIGH", "FROZEN", "CRITICAL", "INVALID_INPUT", "CANCELLED", "OVERDUE"].includes(s)) return "red";
  return "slate";
}

export function Status({ value }: { value?: string }) {
  return <Badge tone={statusTone(value)}>{(value || "—").replace(/_/g, " ")}</Badge>;
}

export function SimTag() {
  return <Badge tone="violet" className="!text-[9px]">Sandbox</Badge>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">{children}</div>;
}

export function KV({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
      <div className="label">{label}</div>
      <div className={clsx("mt-1 text-lg font-semibold tabular-nums", tone === "red" && "text-rose-300", tone === "green" && "text-emerald-300", tone === "amber" && "text-amber-300")}>{value}</div>
    </div>
  );
}
