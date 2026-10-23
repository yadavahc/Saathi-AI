"use client";
import clsx from "clsx";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { Check, HandCoins, LineChart, Package, PhoneCall, Radar, ShoppingCart, Siren, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Counter, Eyebrow, Reveal, SpotlightCard } from "./ui";

function Card({ icon: Icon, title, text, children, className, accent = "emerald" }: {
  icon: any; title: string; text?: string; children: ReactNode; className?: string; accent?: "emerald" | "rose" | "amber" | "sky" | "violet";
}) {
  const tone = { emerald: "text-emerald-600 bg-emerald-100", rose: "text-rose-600 bg-rose-100", amber: "text-amber-600 bg-amber-100",
    sky: "text-sky-600 bg-sky-100", violet: "text-violet-600 bg-violet-100" }[accent];
  return (
    <SpotlightCard className={clsx("p-6", className)}>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3">
          <span className={clsx("grid h-11 w-11 place-items-center rounded-2xl shadow-[inset_0_-3px_6px_rgba(15,23,42,.08),inset_0_2px_4px_rgba(255,255,255,.8)]", tone)}><Icon size={19} /></span>
          <div className="text-[17px] font-bold text-slate-900">{title}</div>
        </div>
        {text && <p className="mt-2 text-[14px] font-medium text-slate-500">{text}</p>}
        <div className="mt-5 flex-1">{children}</div>
      </div>
    </SpotlightCard>
  );
}

function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { once: true, margin: "-80px" });
  return [ref, seen] as const;
}

function Waveform() {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-16 items-center gap-[3px]">
      {Array.from({ length: 48 }).map((_, i) => (
        <motion.span key={i} className="w-[4px] rounded-full bg-gradient-to-t from-emerald-500 to-teal-300"
          animate={reduce ? undefined : { height: [`${15 + ((i * 37) % 60)}%`, `${30 + ((i * 53) % 70)}%`, `${12 + ((i * 29) % 50)}%`] }}
          transition={{ repeat: Infinity, duration: 1.2 + (i % 5) * 0.15, ease: "easeInOut" }} style={{ height: "30%" }} />
      ))}
    </div>
  );
}

function FraudVisual() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <div ref={ref} className="grid gap-4 md:grid-cols-[1fr_auto]">
      <div className="space-y-2.5">
        <Waveform />
        {[["SAATHI", "Namaskara Rahul, ₹25,000 transaction attempt aagide — 11:47 PM. Idu neevu maadidira?"], ["Rahul", "Illa! (No)"], ["SAATHI", "Block maadi fraud complaint register maadla?"], ["Rahul", "Howdu (Yes)"]].map(([who, line], i) => (
          <motion.div key={i} initial={{ opacity: 0, x: who === "Rahul" ? 20 : -20 }} animate={seen ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.3 + i * 0.5 }}
            className={clsx("max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px]", who === "Rahul" ? "ml-auto bg-sky-500 text-white" : "bg-slate-100 text-slate-700")}>
            <span className="mr-1.5 text-[10px] font-bold uppercase opacity-60">{who}</span>{line}
          </motion.div>
        ))}
      </div>
      <div className="flex flex-row flex-wrap gap-2 md:flex-col">
        {["freeze_transaction()", "create_fraud_case()", "send_telegram()"].map((t, i) => (
          <motion.div key={t} initial={{ opacity: 0, scale: 0.8 }} animate={seen ? { opacity: 1, scale: 1 } : {}} transition={{ delay: 2.5 + i * 0.3, type: "spring" }}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-2 font-mono text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
            <Check size={12} />{t}
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0 }} animate={seen ? { opacity: 1 } : {}} transition={{ delay: 3.6 }} className="rounded-xl bg-rose-500 px-2.5 py-2 text-center text-[11px] font-bold text-white shadow-md shadow-rose-500/30">
          Risk <Counter to={91} />/100
        </motion.div>
      </div>
    </div>
  );
}

function SosVisual() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <div ref={ref} className="space-y-3">
      <div className="flex h-10 gap-[2px] overflow-hidden rounded-xl bg-slate-100">
        <motion.div initial={{ width: 0 }} animate={seen ? { width: "75%" } : {}} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center rounded-l-xl bg-emerald-500 text-[11.5px] font-bold text-white">Insurance ₹60k</motion.div>
        <motion.div initial={{ width: 0 }} animate={seen ? { width: "25%" } : {}} transition={{ duration: 1, delay: 1, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center rounded-r-xl bg-amber-400 text-[11.5px] font-bold text-amber-950">Savings</motion.div>
      </div>
      <div className="flex justify-between text-[12px] text-slate-500"><span>Need ₹80,000</span><span className="font-semibold text-emerald-600">No loan needed ✓</span></div>
    </div>
  );
}

function SparkVisual() {
  const [ref, seen] = useSeen<SVGSVGElement>();
  return (
    <svg ref={ref} viewBox="0 0 200 70" className="h-24 w-full overflow-visible">
      <motion.path d="M0 40 C20 38 30 36 45 37 S70 34 85 36 S110 30 125 32 S160 26 200 8" fill="none" stroke="#2a78d6" strokeWidth="2.5" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={seen ? { pathLength: 1 } : {}} transition={{ duration: 1.6 }} />
      <motion.path d="M0 22 C20 21 35 23 50 22 S80 20 95 23 S110 44 125 46 S165 47 200 46" fill="none" stroke="#eb6834" strokeWidth="2.5" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={seen ? { pathLength: 1 } : {}} transition={{ duration: 1.6, delay: 0.3 }} />
      <motion.g initial={{ opacity: 0 }} animate={seen ? { opacity: 1 } : {}} transition={{ delay: 1.8 }}>
        <rect x="128" y="50" rx="6" width="70" height="18" fill="#ffedd5" />
        <text x="163" y="63" textAnchor="middle" fontSize="10" fill="#c2410c" fontWeight="700">evening −31%</text>
      </motion.g>
    </svg>
  );
}

function StockVisual() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <div ref={ref} className="flex items-end gap-4">
      <div className="relative h-24 w-16 overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-50">
        <motion.div initial={{ height: "70%" }} animate={seen ? { height: ["70%", "12%", "12%", "85%"] } : {}} transition={{ duration: 3.4, times: [0, 0.4, 0.65, 1] }}
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-300 to-amber-100" />
        <div className="absolute inset-x-0 top-1 text-center text-[10px] font-bold text-slate-500">RICE</div>
      </div>
      <div className="space-y-1.5 text-[12px]">
        <motion.div initial={{ opacity: 0 }} animate={seen ? { opacity: 1 } : {}} transition={{ delay: 1.2 }} className="font-semibold text-rose-600">8 KG · critical</motion.div>
        <motion.div initial={{ opacity: 0 }} animate={seen ? { opacity: 1 } : {}} transition={{ delay: 1.8 }} className="rounded-lg bg-sky-50 px-2 py-1 text-sky-700 ring-1 ring-sky-100">PO 50 KG · ₹2,400 → Telegram</motion.div>
        <motion.div initial={{ opacity: 0 }} animate={seen ? { opacity: 1 } : {}} transition={{ delay: 2.6 }} className="font-semibold text-emerald-600">Supplier ✓ ACCEPT</motion.div>
      </div>
    </div>
  );
}

function GaugeVisual() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const a = animate(0, 87, { duration: 1.2, onUpdate: setV });
    const t = setTimeout(() => animate(87, 8, { duration: 1.4, ease: [0.22, 1, 0.36, 1], onUpdate: setV }), 2000);
    return () => { a.stop(); clearTimeout(t); };
  }, [seen]);
  const color = v > 60 ? "#f43f5e" : v > 30 ? "#f59e0b" : "#10b981";
  return (
    <div ref={ref} className="flex items-center gap-4">
      <svg viewBox="0 0 120 70" className="w-32">
        <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="#f1f5f9" strokeWidth="11" strokeLinecap="round" />
        <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" pathLength={100} strokeDasharray={`${v} 100`} style={{ transition: "stroke .4s" }} />
        <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0f172a">{Math.round(v)}%</text>
      </svg>
      <div className="text-[12.5px] text-slate-500">₹8,999 AutoPay<br /><span className={clsx("font-semibold", v < 30 ? "text-emerald-600" : "text-rose-600")}>{v < 30 ? "Plan created ✓" : "Likely to fail"}</span></div>
    </div>
  );
}

function CommerceVisual() {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const rows = [["PQR Office Mart", "₹1,500", "no stock"], ["ABC Stationers", "₹1,620", "best"], ["XYZ Book Depot", "₹1,750", "+₹130"]];
  return (
    <div ref={ref} className="space-y-1.5">
      {rows.map(([n, p, tag], i) => (
        <motion.div key={n} initial={{ opacity: 0, y: 8 }} animate={seen ? { opacity: 1, y: 0 } : {}} transition={{ delay: i * 0.25 }}
          className={clsx("flex items-center justify-between rounded-xl px-3 py-2 text-[12.5px] transition-all duration-700",
            tag === "best" && seen ? "bg-emerald-50 font-semibold text-slate-900 ring-2 ring-emerald-300" : "bg-slate-50 text-slate-500")}>
          <span>{n}</span><span className="flex items-center gap-2 tabular-nums">{p}<span className={clsx("text-[10.5px]", tag === "best" ? "text-emerald-600" : "text-slate-400")}>{tag === "best" ? "✓ tomorrow 9 AM" : tag}</span></span>
        </motion.div>
      ))}
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal className="text-center">
          <Eyebrow>Six agents · 52 tools</Eyebrow>
          <h2 className="font-display mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">One companion for <span className="text-gradient">money and business.</span></h2>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-6">
          <Reveal className="md:col-span-4"><Card icon={PhoneCall} accent="rose" title="Fraud blocked by a live voice call" text="Scored, verified by a Kannada call, blocked.">
            <FraudVisual /></Card></Reveal>
          <Reveal className="md:col-span-2" delay={0.1}><Card icon={Siren} accent="amber" title="Money SOS" text="₹80,000 needed — no loan.">
            <SosVisual /></Card></Reveal>
          <Reveal className="md:col-span-2"><Card icon={LineChart} accent="sky" title="Business health, in Kannada" text="“Aaj business hegide?”">
            <SparkVisual /></Card></Reveal>
          <Reveal className="md:col-span-2" delay={0.08}><Card icon={Package} title="Inventory autopilot" text="Low stock → Telegram PO → accepted.">
            <StockVisual /></Card></Reveal>
          <Reveal className="md:col-span-2" delay={0.16}><Card icon={Radar} accent="violet" title="Payment failure, predicted" text="Bounce risk 87% → 8%.">
            <GaugeVisual /></Card></Reveal>
          <Reveal className="md:col-span-3"><Card icon={TrendingUp} title="Growth that measures itself" text="A combo offer, published and measured.">
            <div className="flex items-end gap-6">
              <div className="text-5xl font-black tracking-tight text-emerald-600"><Counter to={42.7} decimals={1} prefix="+" suffix="%" /></div>
              <div className="pb-1.5 text-[13px] text-slate-500">₹8,200 → ₹11,700 / day</div>
            </div></Card></Reveal>
          <Reveal className="md:col-span-3" delay={0.1}><Card icon={ShoppingCart} accent="sky" title="Buy with one sentence" text="One sentence → the best order.">
            <CommerceVisual /></Card></Reveal>
          <Reveal className="md:col-span-6"><Card icon={HandCoins} accent="amber" title="…and much more">
            <div className="flex flex-wrap gap-2">
              {["Cash variance −₹500 settled", "Ramesh reminded · ₹4,500", "Supplier PO accepted", "Claim CLM-2041 submitted", "Family alerted", "Scam number reported"].map((c, i) => (
                <motion.span key={c} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="clay-sm !rounded-full px-3 py-1.5 text-[12.5px] font-medium text-slate-700"><Check size={12} className="mr-1 inline text-emerald-500" />{c}</motion.span>
              ))}
            </div></Card></Reveal>
        </div>
      </div>
    </section>
  );
}
