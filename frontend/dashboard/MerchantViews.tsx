"use client";
import clsx from "clsx";
import { Boxes, HandCoins, Megaphone, ShoppingCart, Store, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Empty, KV, Panel, SimTag, Status } from "@/components/ui";
import { api } from "@/services/api";
import { compactInr, inr, pct, time } from "@/services/format";
import type { Ctx } from "./types";

const AXIS = { stroke: "#64748b", fontSize: 11, tickLine: false, axisLine: false };

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-xl">
      <div className="mb-1 font-semibold text-slate-600">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-slate-700">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />{p.name}<span className="ml-auto pl-3 font-semibold tabular-nums">{inr(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function HealthView(ctx: Ctx) {
  const d = ctx.data;
  if (!d) return null;
  const s = d.sales;
  const expenses = (d.expenses || []).reduce((a: number, e: any) => a + e.amount, 0);
  const rice = (d.inventory || []).find((i: any) => i.sku === "SKU-RICE");
  const credit = (d.customer_credit || []).reduce((a: number, c: any) => a + c.outstanding, 0);
  return (
    <div className="space-y-4">
      <Panel title="Merchant Health — Lakshmi General Stores, Mysuru" icon={<Store size={15} />}
        right={<button className="btn-primary !py-1.5 !text-xs" onClick={() => ctx.ask("Aaj business hegide?", "merchant")}>🎙 “Aaj business hegide?”</button>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KV label="Sales today" value={<>{inr(s.today)} <span className="text-xs text-emerald-700">{pct(s.growth_pct)}</span></>} />
          <KV label="Previous" value={inr(s.yesterday)} />
          <KV label="Expenses" value={inr(expenses)} />
          <KV label="Cash variance" value={inr(d.cash?.variance)} tone={d.cash?.variance < 0 ? "red" : "green"} />
          <KV label="Rice" value={rice && rice.stock < rice.min_stock && !rice.incoming ? "LOW STOCK" : rice?.incoming ? "INCOMING" : "OK"} tone={rice && rice.stock < rice.min_stock && !rice.incoming ? "red" : "green"} />
          <KV label="Customer credit" value={inr(credit)} tone="amber" />
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Daily sales — last 14 days">
          <div className="h-[260px]">
            <ResponsiveContainer>
              <AreaChart data={s.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gEve" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--series-2)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--series-2)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" {...AXIS} />
                <YAxis {...AXIS} width={52} tickFormatter={(v) => compactInr(v)} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(148,163,184,.35)", strokeWidth: 1 }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} iconType="plainline" />
                <Area type="monotone" dataKey="total" name="Total sales" stroke="var(--series-1)" strokeWidth={2} fill="url(#gTotal)" activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="evening" name="Evening (4–7 PM)" stroke="var(--series-2)" strokeWidth={2} fill="url(#gEve)" activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="What matters most">
          <div className="space-y-2.5 text-[13px]">
            <Signal tone="red" title={`Evening sales ${pct(s.evening_change_pct, 0)}`} body={`Week-over-week. Regular customers ${pct(s.customers_change_pct, 0)}. Biggest opportunity.`}
              cta="Plan evening offer" onClick={() => ctx.ask("Evening sales are down — suggest a campaign", "merchant")} />
            {rice && rice.stock < rice.min_stock && !rice.incoming && (
              <Signal tone="red" title={`Rice ${rice.stock} KG (min ${rice.min_stock})`} body={`~${(rice.stock / rice.daily_usage).toFixed(1)} days left. Most urgent.`} cta="Reorder" onClick={() => ctx.ask("Rice stock check maadi", "merchant")} />
            )}
            <Signal tone="amber" title={`Cash variance ${inr(d.cash?.variance)}`} body={`Expected ${inr(d.cash?.expected_cash)}, counted ${inr(d.cash?.actual_cash)}.`} cta="Reconcile" onClick={() => ctx.setView("cash")} />
            <Signal tone="green" title={`Sales ${pct(s.growth_pct)} vs yesterday`} body="Morning bulk orders drove the jump." />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Signal({ tone, title, body, cta, onClick }: { tone: string; title: string; body: string; cta?: string; onClick?: () => void }) {
  return (
    <div className={clsx("flex items-center justify-between gap-3 rounded-xl border p-3",
      tone === "red" ? "border-rose-200 bg-rose-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50")}>
      <div><div className="font-semibold text-slate-900">{title}</div><div className="text-[12px] text-slate-500">{body}</div></div>
      {cta && <button onClick={onClick} className="btn-ghost shrink-0 !py-1 !text-[11.5px]">{cta} →</button>}
    </div>
  );
}

export function CashView(ctx: Ctx) {
  const c = ctx.data?.cash;
  if (!c) return null;
  return (
    <Panel title="Cash Reconciliation" icon={<Wallet size={15} />}
      right={c.status !== "RECONCILED" && <button className="btn-primary !py-1.5 !text-xs" onClick={() => ctx.ask("Cash difference ide, reconcile maadi", "merchant")}>Reconcile with SAATHI</button>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KV label="Expected cash" value={inr(c.expected_cash)} />
        <KV label="Actual cash" value={inr(c.actual_cash)} />
        <KV label="Variance" value={inr(c.variance)} tone={c.variance < 0 ? "red" : "green"} />
        <KV label="Status" value={<Status value={c.status} />} />
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-[12.5px] text-slate-600">
        expected = sales {inr(ctx.data.sales.today)} − cash expenses {inr((ctx.data.expenses || []).reduce((a: number, e: any) => a + e.amount, 0))} = {inr(c.expected_cash)}<br />
        variance = actual {inr(c.actual_cash)} − expected {inr(c.expected_cash)} = {inr(c.variance)}
        <div className="mt-2 font-sans text-[11.5px] text-slate-500">All financial calculations run in backend code — never inside the LLM.</div>
      </div>
      {c.status === "RECONCILED" && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-[12.5px] md:grid-cols-4">
          {[["Date", c.date], ["Reason", c.reason], ["Approved by", c.approved_by], ["Timestamp", time(c.timestamp)]].map(([k, v]) => (
            <div key={k}><div className="label">{k}</div><div className="mt-0.5 text-slate-700">{v}</div></div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function InventoryView(ctx: Ctx) {
  const items = ctx.data?.inventory || [];
  return (
    <Panel title="Inventory Autopilot" icon={<Boxes size={15} />}
      right={<button className="btn-primary !py-1.5 !text-xs" onClick={() => ctx.ask("Rice stock check maadi", "merchant")}>Check & reorder</button>}>
      <table className="w-full text-[12.5px]">
        <thead><tr className="label text-left">{["Item", "Stock", "Level", "Days left", "Supplier pack", "Unit cost", "Status"].map((h) => <th key={h} className="pb-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {items.map((i: any) => {
            const ratio = Math.min(1, i.stock / (i.min_stock * 2));
            const low = i.stock < i.min_stock;
            return (
              <tr key={i.sku} className="table-row">
                <td className="py-2.5 font-semibold text-slate-900">{i.item}</td>
                <td className="tabular-nums">{i.stock} {i.unit} <span className="text-slate-500">/ min {i.min_stock}</span></td>
                <td className="w-40 pr-4">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={clsx("h-full rounded-full", low ? "bg-rose-400" : "bg-emerald-400")} style={{ width: `${ratio * 100}%` }} />
                  </div>
                </td>
                <td className="tabular-nums">{(i.stock / i.daily_usage).toFixed(1)}</td>
                <td>{i.pack_size} {i.unit}</td>
                <td>{inr(i.unit_cost)}</td>
                <td>{i.incoming ? <Badge tone="blue">+{i.incoming} {i.unit} {i.incoming_eta}</Badge> : <Status value={low ? (i.stock < i.min_stock / 2 ? "CRITICAL" : "LOW") : "OK"} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

export function CreditView(ctx: Ctx) {
  const rows = ctx.data?.customer_credit || [];
  return (
    <Panel title="Customer Credit (udhaar)" icon={<HandCoins size={15} />}>
      <table className="w-full text-[12.5px]">
        <thead><tr className="label text-left">{["Customer", "Outstanding", "Overdue", "Reminders", "Status", ""].map((h) => <th key={h} className="pb-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((c: any) => (
            <tr key={c.customer_id} className="table-row">
              <td className="py-2.5 font-semibold text-slate-900">{c.name}</td>
              <td className="font-semibold tabular-nums">{inr(c.outstanding)}</td>
              <td>{c.overdue_days ? <span className="text-rose-600">{c.overdue_days} days</span> : "—"}</td>
              <td>{c.reminders_sent}</td>
              <td><Status value={c.reminder_status || c.status} /></td>
              <td className="text-right">
                {c.overdue_days > 0 && <button className="btn-ghost !py-1 !text-[11.5px]" onClick={() => ctx.ask(`${c.name} ge payment reminder kalisu`, "merchant")}>Send reminder</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.filter((c: any) => c.last_reminder_message).map((c: any) => (
        <div key={c.customer_id} className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12.5px]">
          <div className="label mb-1 !text-emerald-700">Reminder sent to {c.name} · {time(c.last_reminder_at)}</div>
          <div className="whitespace-pre-wrap text-slate-700">{c.last_reminder_message}</div>
        </div>
      ))}
    </Panel>
  );
}

export function OrdersView(ctx: Ctx) {
  const orders = ctx.data?.orders || [];
  return (
    <div className="space-y-4">
      <Panel title="Orders — purchase orders & natural-language commerce" icon={<ShoppingCart size={15} />}
        right={<button className="btn-primary !py-1.5 !text-xs" onClick={() => ctx.ask("I need 20 notebooks and 10 pens tomorrow under ₹2,000.", "consumer")}>“20 notebooks + 10 pens under ₹2,000”</button>}>
        {orders.length === 0 ? <Empty>No orders yet.</Empty> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {orders.map((o: any) => (
              <div key={o.order_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div><div className="font-mono text-[11px] text-slate-500">{o.type.replace(/_/g, " ")}</div><div className="text-[15px] font-bold text-slate-900">{o.order_id} · {o.counterparty}</div></div>
                  <Status value={o.status} />
                </div>
                <div className="mt-2 text-[12.5px] text-slate-600">{o.items.map((i: any) => `${i.name} × ${i.quantity}${i.unit ? " " + i.unit : ""}`).join(", ")}</div>
                <div className="mt-1 flex gap-4 text-[12.5px]"><span>Total <b>{inr(o.amount)}</b></span><span>Delivery <b>{o.delivery}</b></span><SimTag /></div>
                <div className="mt-3 space-y-1 border-l border-slate-200 pl-3">
                  {o.timeline.map((t: any, i: number) => <div key={i} className="text-[11.5px] text-slate-500"><span className="font-mono text-slate-500">{time(t.ts)}</span> · {t.event}</div>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Vendor catalog (commerce)">
        <div className="grid gap-3 md:grid-cols-3">
          {(ctx.data?.vendors || []).map((v: any) => (
            <div key={v.merchant_id} className="rounded-xl border border-slate-200 p-3 text-[12.5px]">
              <div className="font-semibold text-slate-900">{v.name}</div>
              <div className="text-slate-500">★ {v.rating} · {v.distance_km} km · {v.delivery}</div>
              {Object.entries(v.catalog).map(([k, c]: any) => <div key={k} className="mt-1 flex justify-between"><span className="capitalize">{k}</span><span>{inr(c.price)} · stock {c.stock}</span></div>)}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function CampaignsView(ctx: Ctx) {
  const camps = ctx.data?.campaigns || [];
  return (
    <Panel title="Campaigns — detect → create → approve → publish → measure" icon={<Megaphone size={15} />}
      right={<button className="btn-primary !py-1.5 !text-xs" onClick={() => ctx.ask("Evening sales are down — suggest a campaign", "merchant")}>Find growth opportunity</button>}>
      <div className="grid gap-4 lg:grid-cols-2">
        {camps.map((c: any) => (
          <div key={c.campaign_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between">
              <div><div className="font-mono text-[11px] text-slate-500">{c.campaign_id}</div><div className="text-[16px] font-bold text-slate-900">{c.name}</div>
                <div className="text-[12.5px] text-slate-500">{c.offer} · {c.window}</div></div>
              <Status value={c.status} />
            </div>
            {c.after_daily ? (
              <div className="mt-3">
                <div className="h-[150px]">
                  <ResponsiveContainer>
                    <BarChart data={[{ k: "Before", v: c.before_daily }, { k: "After", v: c.after_daily }]} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="k" {...AXIS} />
                      <YAxis {...AXIS} width={48} tickFormatter={(v) => compactInr(v)} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,.06)" }} />
                      <Bar dataKey="v" name="Sales / day" fill="var(--series-1)" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="v" position="top" formatter={(v: number) => inr(v)} style={{ fill: "#e2e8f0", fontSize: 11, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[13px]"><span className="text-xl font-black text-emerald-700">{pct(c.improvement_pct)}</span><span className="text-slate-500">improvement</span>{c.simulated && <SimTag />}</div>
              </div>
            ) : c.status === "LIVE" ? (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-3 text-[12.5px] text-slate-600">
                Live — performance is being tracked…
                <button className="btn-ghost !py-1 !text-[11.5px]" onClick={async () => { await api.measureCampaign(c.campaign_id); ctx.refresh(); }}>Measure now</button>
              </div>
            ) : <div className="mt-3 text-[12.5px] text-slate-500">Awaiting approval to publish.</div>}
          </div>
        ))}
      </div>
    </Panel>
  );
}
