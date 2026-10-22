"use client";
import clsx from "clsx";
import { BadgeCheck, Brain, Database, Gavel, MessageSquareQuote, ShieldCheck, Wrench, Zap } from "lucide-react";
import { AGENT_LABEL, LANG_LABEL } from "@/services/format";
import { Badge, Status } from "./ui";

export const STAGES = ["SAID", "UNDERSTOOD", "DATA", "DECIDED", "APPROVAL", "TOOL", "ACTION", "VERIFIED"] as const;

const META: Record<string, { title: string; icon: any }> = {
  SAID: { title: "What the user said", icon: MessageSquareQuote },
  UNDERSTOOD: { title: "What SAATHI understood", icon: Brain },
  DATA: { title: "What data it found", icon: Database },
  DECIDED: { title: "What SAATHI decided", icon: Zap },
  APPROVAL: { title: "What approval was required", icon: Gavel },
  TOOL: { title: "What tool it used", icon: Wrench },
  ACTION: { title: "What action happened", icon: ShieldCheck },
  VERIFIED: { title: "What result was verified", icon: BadgeCheck },
};

export function stageIndex(run: any): number {
  if (!run) return -1;
  if (run.status === "COMPLETED") return STAGES.length;
  const i = STAGES.indexOf(run.stage);
  return i < 0 ? 0 : i;
}

export default function ActionTrace({ run, approvals, onApprove, onReject }: {
  run: any; approvals: any[]; onApprove: (id: string) => void; onReject: (id: string) => void;
}) {
  if (!run) {
    return (
      <div className="grid h-full place-items-center rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-500">
        <div>
          <div className="text-base font-semibold text-slate-300">No action yet</div>
          <div className="mt-1 text-sm">Press <span className="text-brand-300">START LIVE DEMO</span> or talk to SAATHI — every step from words to verified result appears here.</div>
        </div>
      </div>
    );
  }
  const active = stageIndex(run);
  const runApprovals = approvals.filter((a) => run.approval?.approval_ids?.includes(a.approval_id));
  const writes = (run.tools || []).filter((t: any) => t.mutates);
  const reads = (run.tools || []).filter((t: any) => !t.mutates);
  const u = run.understood || {};

  const body: Record<string, React.ReactNode> = {
    SAID: (
      <div>
        <p className="text-[15px] font-medium leading-snug text-white">“{run.said}”</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="blue">{run.channel}</Badge>
          {run.language && <Badge tone="slate">{LANG_LABEL[run.language] || run.language}</Badge>}
          <Badge tone="slate">{run.source}</Badge>
        </div>
      </div>
    ),
    UNDERSTOOD: u.intents ? (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {u.intents.map((i: string) => <Badge key={i} tone="green">{i.replace(/_/g, " ")}</Badge>)}
        </div>
        <div className="text-xs text-slate-400">
          → {(u.agents || []).map((a: string) => AGENT_LABEL[a] || a).join(" + ")}
          {u.engine && <span className="ml-1.5 text-slate-500">· via {u.engine === "claude" ? "Claude" : u.engine}</span>}
        </div>
        {u.entities && Object.keys(u.entities).length > 0 && (
          <div className="font-mono text-[11px] text-slate-400">
            {Object.entries(u.entities).slice(0, 4).map(([k, v]) => (
              <div key={k}>{k}: <span className="text-slate-200">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span></div>
            ))}
          </div>
        )}
      </div>
    ) : null,
    DATA: run.data?.length ? (
      <div className="grid grid-cols-1 gap-x-3 gap-y-1 text-[12.5px]">
        {run.data.slice(0, 7).map((d: any, i: number) => (
          <div key={i} className="flex justify-between gap-2 border-b border-white/[0.04] pb-1 last:border-0">
            <span className="text-slate-400">{d.label}</span>
            <span className="text-right font-semibold tabular-nums text-slate-100">{String(d.value)}</span>
          </div>
        ))}
        {run.data.length > 7 && <div className="text-[11px] text-slate-500">+{run.data.length - 7} more</div>}
      </div>
    ) : null,
    DECIDED: run.decision ? <p className="text-[13px] leading-relaxed text-slate-200">{run.decision}</p> : null,
    APPROVAL: run.approval?.required ? (
      <div className="space-y-2">
        {runApprovals.map((a) => (
          <div key={a.approval_id} className="rounded-lg border border-white/[0.07] bg-black/20 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10.5px] text-slate-500">{a.approval_id}</span>
              <Status value={a.status} />
            </div>
            <div className="mt-1 text-[12.5px] text-slate-200">{a.description}</div>
            {a.status === "PENDING" && (
              <div className="mt-2 flex gap-2">
                <button className="btn-primary !py-1 !text-xs" onClick={() => onApprove(a.approval_id)}>Approve</button>
                <button className="btn-ghost !py-1 !text-xs" onClick={() => onReject(a.approval_id)}>Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    ) : run.stage === "VERIFIED" || run.status === "COMPLETED" ? <p className="text-[13px] text-slate-400">Not required — read-only answer.</p> : null,
    TOOL: run.tools?.length ? (
      <div className="space-y-1">
        {writes.map((t: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-2 font-mono text-[11.5px]">
            <span className="text-amber-200">{t.name}()</span><Status value={t.status} />
          </div>
        ))}
        <div className="text-[11px] text-slate-500">{reads.length} read tool{reads.length === 1 ? "" : "s"}: {reads.slice(0, 5).map((t: any) => t.name).join(", ")}{reads.length > 5 ? "…" : ""}</div>
      </div>
    ) : null,
    ACTION: run.action ? <p className="text-[13px] font-medium leading-relaxed text-white">{run.action}</p> : null,
    VERIFIED: run.verified ? (
      <div className="space-y-1">
        <p className="font-mono text-[11.5px] leading-relaxed text-emerald-200">{run.verified}</p>
        {run.status === "COMPLETED" && <Badge tone="green">verified by backend</Badge>}
      </div>
    ) : null,
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {STAGES.map((stage, i) => {
        const Icon = META[stage].icon;
        const done = i < active || (i === active && stage === "VERIFIED" && run.status === "COMPLETED");
        const isActive = i === active && run.status !== "COMPLETED";
        const waiting = isActive && stage === "APPROVAL";
        return (
          <div key={stage} className={clsx(
            "relative min-h-[150px] rounded-2xl border p-4 transition-all duration-500 animate-slideUp",
            done && "border-emerald-400/20 bg-emerald-400/[0.035]",
            isActive && (waiting ? "border-amber-400/50 bg-amber-400/[0.06] shadow-[0_0_30px_-8px_rgba(245,158,11,.5)]" : "border-brand-400/60 bg-brand-400/[0.06] shadow-[0_0_30px_-8px_rgba(63,208,166,.55)]"),
            !done && !isActive && "border-white/[0.06] bg-white/[0.015] opacity-60",
          )} style={{ animationDelay: `${i * 40}ms` }}>
            <div className="mb-2.5 flex items-center gap-2">
              <span className={clsx("grid h-7 w-7 place-items-center rounded-lg text-xs font-bold",
                done ? "bg-emerald-400/15 text-emerald-300" : isActive ? "bg-brand-400/20 text-brand-300 animate-pulseRing" : "bg-white/5 text-slate-500")}>
                <Icon size={14} />
              </span>
              <div>
                <div className="label !text-[9.5px]">{String(i + 1).padStart(2, "0")} · {stage}</div>
                <div className="text-[12.5px] font-semibold text-slate-200">{META[stage].title}</div>
              </div>
            </div>
            {body[stage] ?? <div className="text-[12px] text-slate-600">{isActive ? "working…" : "—"}</div>}
          </div>
        );
      })}
    </div>
  );
}
