"use client";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { AGENT_LABEL, inr, time } from "@/services/format";
import { Badge, SimTag, Status } from "./ui";

export default function ApprovalCard({ a, onApprove, onReject }: { a: any; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pending = a.status === "PENDING";
  const act = async (fn: (id: string) => void) => { setBusy(true); try { await fn(a.approval_id); } finally { setBusy(false); } };
  return (
    <div className={`rounded-xl border p-3.5 animate-slideUp ${pending ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="slate">{a.action.replace(/_/g, " ")}</Badge>
          {a.simulated && <SimTag />}
        </div>
        <Status value={a.status} />
      </div>
      <div className="mt-2 text-[13.5px] font-semibold leading-snug text-slate-900">{a.description}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11.5px]">
        {a.amount != null && <div><span className="text-slate-500">Amount</span><div className="font-semibold tabular-nums">{inr(a.amount)}</div></div>}
        {a.target && <div><span className="text-slate-500">Target</span><div className="truncate font-semibold">{a.target}</div></div>}
        {a.impact && <div className="col-span-2"><span className="text-slate-500">Impact</span><div className="text-slate-700">{a.impact}</div></div>}
        {a.reason && <div className="col-span-2"><span className="text-slate-500">Reason</span><div className="text-slate-600">{a.reason}</div></div>}
      </div>
      {a.result?.summary && <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[12px] text-emerald-700">{a.result.summary}</div>}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10.5px] text-slate-500">{AGENT_LABEL[a.agent] || a.agent} · {a.approval_id} · {time(a.created_at)}</span>
        {pending && (
          <div className="flex gap-1.5">
            <button disabled={busy} onClick={() => act(onReject)} className="btn-ghost !px-2.5 !py-1 !text-xs"><X size={12} /> Reject</button>
            <button disabled={busy} onClick={() => act(onApprove)} className="btn-primary !px-2.5 !py-1 !text-xs"><Check size={12} /> Approve</button>
          </div>
        )}
      </div>
    </div>
  );
}
