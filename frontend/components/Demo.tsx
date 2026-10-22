"use client";
import clsx from "clsx";
import { CheckCircle2, CircleDashed, Loader2, X, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";

const SPEAKER_STYLE: Record<string, string> = {
  USER: "text-sky-300", SAATHI: "text-brand-300", SYSTEM: "text-slate-400", TOOL: "text-amber-300", DATA: "text-violet-300",
  SUPPLIER: "text-saffron-400", MERCHANT: "text-saffron-400", CALLER: "text-rose-300",
};

export function DemoStrip({ demo, onScenario }: { demo: any; onScenario: (id: number) => void }) {
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => { feed.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [demo?.narration?.length]);
  if (!demo || demo.status === "idle") return null;
  const lines = (demo.narration || []).filter((n: any) => !n.banner).slice(-14);
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 overflow-x-auto border-b border-white/[0.06] px-4 py-2.5">
        <span className={clsx("label mr-2 shrink-0", demo.status === "running" && "!text-brand-300")}>
          {demo.status === "running" ? "● Live demo" : demo.status === "complete" ? "Demo complete" : "Demo stopped"} · {demo.mode}
        </span>
        {demo.scenarios.map((s: any) => (
          <button key={s.id} onClick={() => onScenario(s.id)} disabled={demo.status === "running"} title={`Replay demo ${s.id}`}
            className={clsx("flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition",
              s.status === "running" && "border-brand-400/60 bg-brand-400/15 text-brand-100",
              s.status === "done" && "border-emerald-400/20 text-emerald-300",
              s.status === "error" && "border-rose-400/30 text-rose-300",
              s.status === "pending" && "border-white/[0.07] text-slate-500")}>
            {s.status === "running" ? <Loader2 size={12} className="animate-spin" /> : s.status === "done" ? <CheckCircle2 size={12} /> :
              s.status === "error" ? <XCircle size={12} /> : <CircleDashed size={12} />}
            {s.id}. {s.title}
          </button>
        ))}
      </div>
      <div ref={feed} className="max-h-[132px] space-y-1 overflow-y-auto px-4 py-2.5 font-mono text-[12px]">
        {lines.map((n: any, i: number) => (
          <div key={i} className="flex gap-2 animate-slideUp">
            <span className={clsx("w-[74px] shrink-0 font-bold", SPEAKER_STYLE[n.speaker] || "text-slate-400")}>{n.speaker}</span>
            <span className={clsx("text-slate-200", n.verified && "text-emerald-200")}>{n.text}{n.verified && " ✓"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ImpactModal({ demo, onClose }: { demo: any; onClose: () => void }) {
  if (!demo?.impact) return null;
  const all = demo.impact.flatMap((g: any) => g.items);
  const done = all.filter((i: any) => i.done).length;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-sm animate-slideUp">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-ink-900 p-8 shadow-2xl">
        <button onClick={onClose} className="absolute right-5 top-5 text-slate-400 hover:text-white"><X size={20} /></button>
        <div className="text-center">
          <div className="text-xs font-bold tracking-[0.3em] text-brand-300">SAATHI AI</div>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
            DON'T JUST TELL ME WHAT HAPPENED.<br /><span className="bg-gradient-to-r from-brand-300 to-saffron-400 bg-clip-text text-transparent">HELP ME FIX IT.</span>
          </h2>
          <div className="mt-3 text-sm text-slate-400">{done} of {all.length} outcomes completed and verified against backend state</div>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {demo.impact.map((g: any) => (
            <div key={g.group} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="label mb-2">{g.group}</div>
              {g.items.map((i: any) => (
                <div key={i.label} className="flex items-center gap-2 py-1 text-[13.5px]">
                  {i.done ? <CheckCircle2 size={16} className="shrink-0 text-emerald-400" /> : <CircleDashed size={16} className="shrink-0 text-slate-600" />}
                  <span className={i.done ? "text-slate-100" : "text-slate-500"}>{i.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-7 gap-1 text-center text-[10px] font-bold tracking-wider text-slate-400">
          {["UNDERSTAND", "ANALYZE", "RECOMMEND", "APPROVE", "EXECUTE", "VERIFY", "MEASURE"].map((s) => (
            <div key={s} className="rounded-lg border border-brand-400/20 bg-brand-400/[0.06] py-2 text-brand-200">{s}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
