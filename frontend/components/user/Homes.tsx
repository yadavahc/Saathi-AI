"use client";
import clsx from "clsx";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Eye, Package, Wallet } from "lucide-react";
import { compactInr, inr } from "@/services/format";
import { Card, Pill, Section, friendlyStatus } from "./parts";

const LEVEL = {
  HIGH: { bar: "bg-rose-500", icon: AlertTriangle, iconCls: "text-rose-600 bg-rose-50" },
  MEDIUM: { bar: "bg-amber-500", icon: AlertTriangle, iconCls: "text-amber-600 bg-amber-50" },
  WATCH: { bar: "bg-sky-400", icon: Eye, iconCls: "text-sky-600 bg-sky-50" },
  HEALTHY: { bar: "bg-emerald-500", icon: CheckCircle2, iconCls: "text-emerald-600 bg-emerald-50" },
} as const;

function AlertRow({ item, onAsk }: { item: any; onAsk: (prompt: string) => void }) {
  const l = LEVEL[item.level as keyof typeof LEVEL] || LEVEL.WATCH;
  const Icon = l.icon;
  return (
    <Card className="relative overflow-hidden !p-0">
      <div className={clsx("absolute inset-y-0 left-0 w-1", l.bar)} />
      <div className="flex items-center gap-3 p-4 pl-5">
        <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-2xl", l.iconCls)}><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-snug">{item.title}</div>
          <div className="text-[13px] text-stone-500">{item.subtitle}</div>
          {item.recommend && item.level !== "HEALTHY" && <div className="mt-1 text-[12.5px] text-stone-600">💡 {item.recommend}</div>}
        </div>
        {item.action?.prompt && (
          <button onClick={() => onAsk(item.action.prompt)} className="shrink-0 rounded-xl bg-stone-900 px-3 py-2 text-[12.5px] font-semibold text-white active:scale-95">
            Fix it
          </button>
        )}
      </div>
    </Card>
  );
}

export function RahulHome({ d, onAsk }: { d: any; onAsk: (prompt: string) => void }) {
  const f = d.financial;
  const alerts = d.alerts || [];
  return (
    <div className="space-y-6">
      <Card className="!p-5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-stone-500"><Wallet size={15} /> Account balance</div>
        <div className="mt-1 text-[34px] font-extrabold tracking-tight tabular-nums">{inr(f.current_balance)}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-4 text-[12.5px]">
          <div><div className="text-stone-500">Savings</div><div className="mt-0.5 text-[15px] font-bold tabular-nums">{inr(f.savings_balance)}</div></div>
          <div><div className="text-stone-500">Health cover</div><div className="mt-0.5 text-[15px] font-bold tabular-nums">{inr(f.insurance_coverage)}</div></div>
          <div><div className="text-stone-500">Salary in</div><div className="mt-0.5 text-[15px] font-bold">{f.salary_in_days} days</div></div>
        </div>
      </Card>

      <Section title="SAATHI is watching">
        <div className="space-y-2.5">{alerts.map((a: any) => <AlertRow key={a.id} item={a} onAsk={onAsk} />)}</div>
      </Section>

      <Section title="Coming up">
        <Card className="!p-0">
          {d.recurring.map((r: any, i: number) => (
            <div key={r.rp_id} className={clsx("flex items-center justify-between px-4 py-3.5", i && "border-t border-stone-100")}>
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-semibold">{r.name}</div>
                <div className="text-[12.5px] text-stone-500">{r.mandate} · in {r.due_in_days} days</div>
              </div>
              <div className="text-[15px] font-bold tabular-nums">{inr(r.amount)}</div>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Recent payments">
        <Card className="!p-0">
          {d.transactions.map((t: any, i: number) => {
            const s = friendlyStatus(t.status);
            return (
              <div key={t.txn_id} className={clsx("flex items-center gap-3 px-4 py-3", i && "border-t border-stone-100")}>
                <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full", t.status === "FROZEN" ? "bg-rose-50 text-rose-600" : "bg-stone-100 text-stone-500")}>
                  <ArrowUpRight size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-semibold">{t.recipient}</div>
                  <div className="text-[12px] text-stone-500">{t.date} · {t.time}</div>
                </div>
                <div className="text-right">
                  <div className="text-[14.5px] font-bold tabular-nums">−{inr(t.amount)}</div>
                  {t.status !== "COMPLETED" && <Pill tone={s.tone}>{s.label}</Pill>}
                </div>
              </div>
            );
          })}
        </Card>
      </Section>
    </div>
  );
}

export function LakshmiHome({ d, onAsk }: { d: any; onAsk: (prompt: string) => void }) {
  const s = d.sales;
  const low = d.inventory.filter((i: any) => i.stock < i.min_stock && !i.incoming);
  const owed = d.credit.filter((c: any) => c.outstanding > 0);
  return (
    <div className="space-y-6">
      <Card className="!p-5">
        <div className="text-[13px] font-medium text-stone-500">Today's sales · {d.merchant?.name}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[34px] font-extrabold tracking-tight tabular-nums">{inr(s.today)}</span>
          <span className={clsx("flex items-center text-[14px] font-bold", s.growth_pct >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {s.growth_pct >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}{Math.abs(s.growth_pct)}%
          </span>
        </div>
        <div className="text-[12.5px] text-stone-500">vs {inr(s.yesterday)} yesterday</div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-4 text-[12.5px]">
          <div><div className="text-stone-500">Expenses</div><div className="mt-0.5 text-[15px] font-bold tabular-nums">{inr(d.expenses)}</div></div>
          <div><div className="text-stone-500">Cash in drawer</div><div className="mt-0.5 text-[15px] font-bold tabular-nums">{inr(d.cash.actual_cash)}</div></div>
          <div>
            <div className="text-stone-500">Difference</div>
            <div className={clsx("mt-0.5 text-[15px] font-bold tabular-nums", d.cash.variance < 0 && d.cash.status !== "RECONCILED" ? "text-rose-600" : "")}>
              {d.cash.status === "RECONCILED" ? "Settled ✓" : inr(d.cash.variance)}
            </div>
          </div>
        </div>
        {d.cash.variance !== 0 && d.cash.status !== "RECONCILED" && (
          <button onClick={() => onAsk("Galla mein cash kam hai, reconcile karo")} className="mt-3 w-full rounded-2xl bg-stone-100 py-2.5 text-[13px] font-semibold text-stone-700">
            Settle today's cash difference
          </button>
        )}
      </Card>

      {d.attention.length > 0 && (
        <Section title="Needs your attention">
          <div className="space-y-2.5">{d.attention.map((a: any) => <AlertRow key={a.id} item={a} onAsk={onAsk} />)}</div>
        </Section>
      )}

      <Section title="Stock" action={low.length ? <Pill tone="red">{low.length} running low</Pill> : <Pill tone="green">All good</Pill>}>
        <Card className="!p-0">
          {d.inventory.map((i: any, idx: number) => {
            const pct = Math.min(100, (i.stock / (i.min_stock * 2)) * 100);
            const isLow = i.stock < i.min_stock;
            return (
              <div key={i.sku} className={clsx("px-4 py-3", idx && "border-t border-stone-100")}>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="flex items-center gap-2 font-semibold"><Package size={14} className="text-stone-400" />{i.item}</span>
                  <span className={clsx("tabular-nums", isLow && !i.incoming ? "font-bold text-rose-600" : "text-stone-600")}>
                    {i.stock} {i.unit}{i.incoming ? <span className="ml-1.5 text-emerald-600">+{i.incoming} coming</span> : null}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div className={clsx("h-full rounded-full", isLow && !i.incoming ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </Card>
      </Section>

      <Section title="Who owes you" action={<span className="text-[13px] font-semibold text-stone-500">{inr(owed.reduce((a: number, c: any) => a + c.outstanding, 0))}</span>}>
        <Card className="!p-0">
          {owed.map((c: any, idx: number) => (
            <div key={c.customer_id} className={clsx("flex items-center gap-3 px-4 py-3", idx && "border-t border-stone-100")}>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-[14px] font-bold text-amber-700">{c.name[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold">{c.name}</div>
                <div className="text-[12px] text-stone-500">{c.overdue_days ? `${c.overdue_days} days overdue` : "Not due yet"}</div>
              </div>
              <div className="text-right">
                <div className="text-[14.5px] font-bold tabular-nums">{inr(c.outstanding)}</div>
                {c.reminder_status ? <Pill tone="green">Reminded</Pill> : c.overdue_days > 0 ? (
                  <button onClick={() => onAsk(`${c.name} ge payment reminder kalisu`)} className="text-[12px] font-semibold text-emerald-700">Remind</button>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      </Section>

      {(d.orders.length > 0 || d.campaigns.length > 0) && (
        <Section title="Orders & offers">
          <div className="space-y-2.5">
            {d.orders.map((o: any) => {
              const st = friendlyStatus(o.status);
              return (
                <Card key={o.order_id} className="flex items-center justify-between">
                  <div>
                    <div className="text-[14.5px] font-semibold">{o.items.map((i: any) => `${i.name} ${i.quantity} ${i.unit || ""}`).join(", ")}</div>
                    <div className="text-[12.5px] text-stone-500">{o.counterparty} · {o.delivery} · {inr(o.amount)}</div>
                  </div>
                  <Pill tone={st.tone}>{st.label}</Pill>
                </Card>
              );
            })}
            {d.campaigns.map((c: any) => {
              const st = friendlyStatus(c.status);
              return (
                <Card key={c.campaign_id}>
                  <div className="flex items-center justify-between">
                    <div className="text-[14.5px] font-semibold">{c.name} · {inr(c.price)}</div>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                  <div className="text-[12.5px] text-stone-500">{c.window}</div>
                  {c.after_daily && (
                    <div className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
                      Evening sales {compactInr(c.before_daily)} → <b>{compactInr(c.after_daily)}</b>/day (+{c.improvement_pct}%)
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
