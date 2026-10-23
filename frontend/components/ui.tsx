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
          <div className="flex min-w-0 items-center gap-2.5 text-[14px] font-semibold text-slate-900">
            {icon && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">{icon}</span>}
            <span className="min-w-0">{title}</span>
          </div>
          {right}
        </header>
      )}
      <div className={clsx("p-5", bodyClass)}>{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-rose-200 bg-rose-50 text-rose-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
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
  const tone = statusTone(value);
  return (
    <Badge tone={tone}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500 live-dot" : tone === "red" ? "bg-rose-500" : "bg-slate-400")} />
      {(value || "—").replace(/_/g, " ")}
    </Badge>
  );
}

export function SimTag() {
  return <Badge tone="violet" className="!text-[9px]">Sandbox</Badge>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">{children}</div>;
}

export function KV({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3.5">
      <div className="label">{label}</div>
      <div className={clsx("mt-1.5 text-lg font-semibold tabular-nums text-slate-900", tone === "red" && "!text-rose-600", tone === "green" && "!text-emerald-600", tone === "amber" && "!text-amber-600")}>{value}</div>
    </div>
  );
}
