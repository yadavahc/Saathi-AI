"use client";
import clsx from "clsx";
import { GitBranch, PhoneCall, Radar } from "lucide-react";
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
    <div className="space-y-4">
      <Panel title="Action Trace — from words to verified result" icon={<GitBranch size={15} />}
        right={
          <div className="flex max-w-[60%] gap-1 overflow-x-auto">
            {(data?.runs || []).slice(0, 8).map((r: any) => (
              <button key={r.run_id} onClick={() => setRunId(r.run_id === runId ? null : r.run_id)}
                className={clsx("shrink-0 rounded-lg border px-2 py-1 font-mono text-[10.5px]",
                  r.run_id === run?.run_id ? "border-brand-400/50 bg-brand-400/10 text-brand-200" : "border-white/[0.07] text-slate-500 hover:text-slate-300")}>
                {r.run_id}
              </button>
            ))}
          </div>
        }>
        <div className="mb-4 rounded-xl border border-white/[0.05] bg-black/20 px-3 py-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label">Live agent flow</span>
            {run && <span className="flex items-center gap-2 text-[11px] text-slate-400">{(run.agents || []).map((a: string) => AGENT_LABEL[a]).join(" + ")} <Status value={run.status} /></span>}
          </div>
          <LiveAgentFlow run={run} />
        </div>
        <ActionTrace run={run} approvals={data?.approvals || []} onApprove={ctx.approve} onReject={ctx.reject} />
        {run?.reply && (
          <div className="mt-4 rounded-xl border border-brand-400/20 bg-brand-400/[0.04] px-4 py-3 text-[13.5px] leading-relaxed text-slate-100">
            <span className="label mr-2 !text-brand-300">SAATHI said</span>{run.reply}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Live AI Call" icon={<PhoneCall size={15} />} right={<button className="text-xs text-slate-400 hover:text-white" onClick={() => ctx.setView("calls")}>Open →</button>}>
          <LiveCallPanel call={call} voiceOn={ctx.voiceOn} compact onChange={ctx.refresh} />
        </Panel>
        <Panel title="Financial Radar" icon={<Radar size={15} />} right={<button className="text-xs text-slate-400 hover:text-white" onClick={() => ctx.setView("radar")}>All alerts →</button>}>
          <div className="space-y-2.5">
            {radar.map((item: any) => <RadarCard key={item.id} item={item} ctx={ctx} compact />)}
          </div>
        </Panel>
      </div>

      <Panel title="Latest actions (audit trail)">
        <div className="space-y-1">
          {writes.map((a: any) => (
            <div key={a.log_id} className="flex items-center gap-3 border-b border-white/[0.04] py-1.5 text-[12.5px] last:border-0">
              <span className="w-[68px] shrink-0 font-mono text-[11px] text-slate-500">{time(a.timestamp)}</span>
              <Badge tone="slate">{AGENT_LABEL[a.agent] || a.agent}</Badge>
              <span className="flex-1 truncate text-slate-200">{a.message}</span>
              <Status value={a.status} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
