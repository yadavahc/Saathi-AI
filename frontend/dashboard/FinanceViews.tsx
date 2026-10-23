"use client";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Eye, PhoneCall, ShieldAlert, Siren } from "lucide-react";
import LiveCallPanel from "@/components/LiveCallPanel";
import { Badge, Empty, KV, Panel, SimTag, Status } from "@/components/ui";
import { api } from "@/services/api";
import { inr, time } from "@/services/format";
import type { Ctx } from "./types";

const LEVEL: Record<string, { tone: string; dot: string; icon: any; label: string }> = {
  HIGH: { tone: "border-rose-200 bg-rose-50", dot: "bg-rose-400", icon: AlertTriangle, label: "HIGH RISK" },
  MEDIUM: { tone: "border-orange-200 bg-orange-50", dot: "bg-orange-400", icon: AlertTriangle, label: "MEDIUM RISK" },
  WATCH: { tone: "border-amber-200 bg-amber-50", dot: "bg-amber-300", icon: Eye, label: "WATCH" },
  HEALTHY: { tone: "border-emerald-200 bg-emerald-50", dot: "bg-emerald-400", icon: CheckCircle2, label: "HEALTHY" },
};

export function RadarCard({ item, ctx, compact = false }: { item: any; ctx: Ctx; compact?: boolean }) {
  const l = LEVEL[item.level];
  const act = () => {
    if (!item.action) return;
    if (item.action.view) ctx.setView(item.action.view);
    else ctx.ask(item.action.prompt, item.action.persona);
  };
  return (
    <div className={clsx("rounded-xl border p-3.5 animate-slideUp", l.tone)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", l.dot)} />
          <div>
            <div className="text-[10px] font-bold tracking-widest text-slate-500">{l.label} · {item.category}</div>
            <div className="text-[14px] font-semibold text-slate-900">{item.title}</div>
            <div className="text-[12px] text-slate-500">{item.subtitle}</div>
          </div>
        </div>
        {item.action && <button onClick={act} className="btn-ghost shrink-0 !py-1 !text-[11.5px]">{item.action.label} →</button>}
      </div>
      {!compact && (
        <div className="mt-3 grid gap-2 text-[12.5px] md:grid-cols-3">
          {[["What we found", item.found], ["Why it matters", item.why], ["What SAATHI recommends", item.recommend]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 p-2.5"><div className="label mb-1 !text-[9.5px]">{k}</div><div className="text-slate-700">{v}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CallsView(ctx: Ctx) {
  const calls = ctx.data?.calls || [];
  return (
    <div className="space-y-6">
      <Panel title="Live AI Call — fraud voice verification" icon={<PhoneCall size={15} />}
        right={<button className="btn-ghost !py-1 !text-xs" onClick={async () => { await api.injectFraud(); ctx.refresh(); }}>Simulate fraud attempt</button>}>
        <LiveCallPanel call={calls[0]} voiceOn={ctx.voiceOn} onChange={ctx.refresh} />
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="How the call works">
          <ol className="space-y-2 text-[13px] text-slate-600">
            {["Transaction arrives → risk scored by backend (not the LLM)", "HIGH risk → Vobiz places the call (or simulated line)", "Sarvam speaks Kannada: “Idu neevu maadidira?”",
              "User denies → SAATHI asks for explicit approval", "Approved → freeze_transaction · create_fraud_case · send_telegram", "Backend re-reads state to verify → audit trail"].map((s, i) => (
              <li key={s} className="flex gap-2.5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{i + 1}</span>{s}</li>
            ))}
          </ol>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[12px] text-slate-500">🔒 SAATHI never asks for OTP, PIN, CVV or passwords.</div>
        </Panel>
        <Panel title="Call history">
          {calls.length === 0 ? <Empty>No calls yet.</Empty> : calls.map((c: any) => (
            <div key={c.call_id} className="flex items-center justify-between border-b border-slate-200 py-2 text-[12.5px] last:border-0">
              <div><div className="font-semibold">{c.call_id} · {c.user}</div><div className="text-slate-500">{c.reason} · {c.risk}</div></div>
              <Status value={c.status} />
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

export function RadarView(ctx: Ctx) {
  const items = ctx.data?.radar || [];
  return (
    <Panel title="Financial Radar — problems found before they happen">
      <div className="space-y-3">{items.map((item: any) => <RadarCard key={item.id} item={item} ctx={ctx} />)}</div>
    </Panel>
  );
}

export function FraudView(ctx: Ctx) {
  const txns = ctx.data?.transactions || [];
  const cases = ctx.data?.fraud_cases || [];
  return (
    <div className="space-y-4">
      <Panel title="Transactions — scored by the Financial Safety Agent" icon={<ShieldAlert size={15} />}
        right={<button className="btn-danger !py-1.5 !text-xs" onClick={async () => { await api.injectFraud(); ctx.refresh(); ctx.setView("calls"); }}>Inject ₹25,000 attempt</button>}>
        <table className="w-full text-[12.5px]">
          <thead className="text-left"><tr className="label">{["Txn", "Date / time", "Recipient", "Amount", "Risk", "Status"].map((h) => <th key={h} className="pb-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {txns.map((t: any) => (
              <tr key={t.txn_id} className={clsx("table-row", t.risk_level === "HIGH" && "bg-rose-50")}>
                <td className="py-2 font-mono text-[11px] text-slate-500">{t.txn_id}</td>
                <td>{t.date} {t.time}</td>
                <td>{t.recipient} {t.is_new_recipient && <Badge tone="amber">new</Badge>}</td>
                <td className="font-semibold tabular-nums">{inr(t.amount)}</td>
                <td>{t.risk_score != null ? <span className={clsx("font-bold tabular-nums", t.risk_score >= 75 ? "text-rose-600" : "text-slate-500")}>{t.risk_score}/100</span> : "—"}</td>
                <td><Status value={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Fraud cases">
        {cases.length === 0 ? <Empty>No fraud cases. Run Demo 1 or inject an attempt.</Empty> : cases.map((c: any) => (
          <div key={c.case_id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-[13px]">
            <div>
              <div className="font-semibold text-slate-900">{c.case_id} · {inr(c.amount)} to {c.recipient} <SimTag /></div>
              <div className="text-slate-500">{c.summary} · {c.reference}</div>
            </div>
            <Status value={c.status} />
          </div>
        ))}
      </Panel>
    </div>
  );
}

export function SOSView(ctx: Ctx) {
  const f = ctx.data?.financial;
  const claims = ctx.data?.claims || [];
  if (!f) return null;
  return (
    <div className="space-y-4">
      <Panel title="Money SOS — urgent needs, solved safely" icon={<Siren size={15} />}
        right={<button className="btn-primary !py-1.5 !text-xs" onClick={() => ctx.ask("I need ₹80,000 urgently for a hospital admission.", "consumer")}>“I need ₹80,000 urgently”</button>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KV label="Savings" value={inr(f.savings_balance)} />
          <KV label="Insurance coverage" value={inr(f.insurance_coverage)} tone="green" />
          <KV label="Upcoming EMI" value={inr(f.monthly_emi)} tone="amber" />
          <KV label="Available financing" value={inr(f.preapproved_loan)} />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-600">
          <div className="label mb-2">SAATHI's safety order</div>
          <div className="grid gap-2 md:grid-cols-3">
            {[["1 · Insurance", "Zero-cost money first, if the need is covered (medical)."], ["2 · Savings", `Above a reserve that protects your ${inr(f.monthly_emi)} EMI.`], ["3 · Credit", `Pre-approved ${inr(f.preapproved_loan)} @ ${f.loan_rate_pct}% only as last resort.`]].map(([k, v]) => (
              <div key={k}><div className="font-semibold text-slate-900">{k}</div><div className="text-slate-500">{v}</div></div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel title="Insurance claims">
        {claims.length === 0 ? <Empty>No claims yet.</Empty> : claims.map((c: any) => (
          <div key={c.claim_id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-[13px]">
            <div><div className="text-lg font-bold text-slate-900">{c.claim_id} <SimTag /></div><div className="text-slate-500">{c.insurer} · {inr(c.amount)} · {c.reason} · {time(c.submitted_at)}</div></div>
            <Status value={c.status} />
          </div>
        ))}
      </Panel>
    </div>
  );
}
