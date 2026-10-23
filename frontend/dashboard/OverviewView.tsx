"use client";
import clsx from "clsx";
import { Activity, GitBranch, PhoneCall, Radar } from "lucide-react";
import ActionTrace from "@/components/ActionTrace";
import LiveAgentFlow from "@/components/LiveAgentFlow";
import LiveCallPanel from "@/components/LiveCallPanel";
import { Badge, Panel, Status } from "@/components/ui";
import { AGENT_LABEL, time } from "@/services/format";
import { RadarCard } from "./FinanceViews";
import type { Ctx } from "./types";

export function pickRun(data: any, runId: string | null) {
  const runs = data?.runs || [];
  return runs.find((r: any) => r.run_id === runId) || runs[0] || null;
}

export default function OverviewView(ctx: Ctx) {
  const { data, runId, setRunId } = ctx;
  const run = pickRun(data, runId);
  const call = data?.calls?.[0];
  const radar = (data?.radar || []).slice(0, 4);
  const writes = (data?.activity || []).filter((a: any) => a.kind !== "tool_read").slice(0, 8);
  return (
    <div className="space-y-6">
      <Panel title="Live agent activity" icon={<GitBranch size={15} />}
        right={
          <div className="flex max-w-[60%] items-center gap-1.5 overflow-x-auto">
            <span className="hidden text-[11.5px] text-slate-400 md:inline">Runs</span>
            {(data?.runs || []).slice(0, 8).map((r: any) => (
              <button key={r.run_id} onClick={() => setRunId(r.run_id === runId ? null : r.run_id)}
                className={clsx("shrink-0 rounded-lg border px-2 py-1 font-mono text-[10.5px] transition",
                  r.run_id === run?.run_id ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:text-slate-800")}>
                {r.run_id}
              </button>
            ))}
          </div>
        }>
        <div className="mb-5 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Pipeline</span>
            {run && <span className="flex items-center gap-2 text-[11.5px] text-slate-500">{(run.agents || []).map((a: string) => AGENT_LABEL[a]).join(" + ")} <Status value={run.status} /></span>}
          </div>
          <LiveAgentFlow run={run} />
        </div>
        <ActionTrace run={run} approvals={data?.approvals || []} onApprove={ctx.approve} onReject={ctx.reject} />
        {run?.reply && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3.5 text-[13.5px] leading-relaxed text-slate-800">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-amber-400 text-[12px] font-black text-white">स</span>
            <div><span className="label mr-2 !text-emerald-700">SAATHI said</span>{run.reply}</div>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr_1fr]">
        <Panel title="Live AI call" icon={<PhoneCall size={15} />} right={<button className="text-xs font-semibold text-emerald-700 hover:text-emerald-800" onClick={() => ctx.setView("calls")}>Open →</button>}>
          <LiveCallPanel call={call} voiceOn={ctx.voiceOn} compact onChange={ctx.refresh} />
        </Panel>
        <Panel title="Financial radar" icon={<Radar size={15} />} right={<button className="text-xs font-semibold text-emerald-700 hover:text-emerald-800" onClick={() => ctx.setView("radar")}>All alerts →</button>}>
          <div className="space-y-3">
            {radar.map((item: any) => <RadarCard key={item.id} item={item} ctx={ctx} compact />)}
          </div>
        </Panel>
        <Panel title="Latest actions" icon={<Activity size={15} />} right={<button className="text-xs font-semibold text-emerald-700 hover:text-emerald-800" onClick={() => ctx.setView("activity")}>Audit log →</button>}>
          <ol className="relative space-y-3 border-l border-slate-200 pl-4">
            {writes.map((a: any) => (
              <li key={a.log_id} className="relative animate-slideUp">
                <span className={clsx("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white",
                  a.status === "SUCCESS" || a.status === "EXECUTED" ? "bg-emerald-500" : a.status === "WARNING" || a.status === "PENDING" ? "bg-amber-500" : a.status === "FAILED" ? "bg-rose-500" : "bg-slate-300")} />
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="font-mono">{time(a.timestamp)}</span>
                  <Badge tone="slate">{AGENT_LABEL[a.agent] || a.agent}</Badge>
                </div>
                <div className="mt-0.5 text-[12.5px] leading-snug text-slate-700">{a.message}</div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
