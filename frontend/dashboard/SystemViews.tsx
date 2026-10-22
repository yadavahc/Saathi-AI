"use client";
import clsx from "clsx";
import { Activity, Bot, Cart, ShieldAlert, Siren, Store, TrendingUp, Radar } from "./icons";
import { useState } from "react";
import { Badge, Panel, Status } from "@/components/ui";
import { AGENT_LABEL, time } from "@/services/format";
import type { Ctx } from "./types";

const ICONS: Record<string, any> = { shield: ShieldAlert, siren: Siren, store: Store, trending: TrendingUp, radar: Radar, cart: Cart };

export function AgentsView(ctx: Ctx) {
  const agents = ctx.data?.agents || [];
  const tools = ctx.data?.tools || [];
  return (
    <div className="space-y-4">
      <Panel title="Multi-agent architecture — Claude routes, agents reason, tools act" icon={<Bot size={15} />}>
        <div className="mb-4 grid gap-2 text-center text-[11px] font-bold tracking-wider md:grid-cols-5">
          {["USER / EVENT", "CLAUDE ROUTER · intent · agent · risk", "SPECIALIST AGENTS", "APPROVAL ENGINE", "TOOLS → DATA · TELEGRAM · VOICE"].map((s, i) => (
            <div key={s} className={clsx("rounded-xl border px-2 py-3", i === 1 ? "border-violet-400/30 bg-violet-400/10 text-violet-200" : i === 3 ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-white/[0.07] bg-white/[0.02] text-slate-300")}>{s}</div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a: any) => {
            const Icon = ICONS[a.icon] || Bot;
            return (
              <div key={a.id} className={clsx("rounded-2xl border p-4", a.active ? "border-brand-400/40 bg-brand-400/[0.05]" : "border-white/[0.07] bg-white/[0.02]")}>
                <div className="flex items-center gap-2.5">
                  <span className={clsx("grid h-9 w-9 place-items-center rounded-xl", a.active ? "bg-brand-400/20 text-brand-200 animate-pulseRing" : "bg-white/5 text-slate-300")}><Icon size={16} /></span>
                  <div className="flex-1"><div className="font-semibold text-white">{a.name}</div><div className="text-[11.5px] text-slate-500">{a.tool_calls} tool calls · {a.actions} actions</div></div>
                  {a.active && <Badge tone="green">active</Badge>}
                </div>
                <p className="mt-2 text-[12.5px] text-slate-400">{a.purpose}</p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {a.tools.map((t: string) => <span key={t} className="rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-400">{t}()</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title={`Tool orchestrator — ${tools.length} registered tools`}>
        <div className="mb-2 text-[12px] text-slate-400">Each tool validates inputs, performs the operation, returns structured JSON, updates data, writes an activity log, updates the dashboard and handles errors. Claude never modifies records directly.</div>
        <div className="flex flex-wrap gap-1.5">
          {tools.map((t: any) => (
            <span key={t.name} className={clsx("rounded-md border px-2 py-1 font-mono text-[11px]", t.mutates ? "border-amber-400/25 text-amber-200" : "border-white/[0.07] text-slate-400")}>
              {t.name}() {t.mutates && "✎"}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function ActivityView(ctx: Ctx) {
  const [reads, setReads] = useState(false);
  const rows = (ctx.data?.activity || []).filter((a: any) => reads || a.kind !== "tool_read");
  return (
    <Panel title="Activity Log — every AI decision is explainable" icon={<Activity size={15} />}
      right={<label className="flex items-center gap-2 text-[12px] text-slate-400"><input type="checkbox" checked={reads} onChange={(e) => setReads(e.target.checked)} /> show read tools</label>}>
      <table className="w-full text-[12px]">
        <thead><tr className="label text-left">{["Time", "Agent", "Tool", "Event", "Approval", "Status"].map((h) => <th key={h} className="pb-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((a: any) => (
            <tr key={a.log_id} className="table-row align-top">
              <td className="whitespace-nowrap py-2 pr-3 font-mono text-[11px] text-slate-500">{time(a.timestamp)}</td>
              <td className="pr-3"><Badge tone="slate">{AGENT_LABEL[a.agent] || a.agent}</Badge></td>
              <td className="pr-3 font-mono text-[11px] text-amber-200/80">{a.tool}</td>
              <td className="pr-3 text-slate-200">{a.message}</td>
              <td className="pr-3 font-mono text-[11px] text-slate-500">{a.approval}</td>
              <td><Status value={a.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
