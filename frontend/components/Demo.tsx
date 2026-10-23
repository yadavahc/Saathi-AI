"use client";
import clsx from "clsx";
import { CheckCircle2, CircleDashed, Loader2, X, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";

const SPEAKER_STYLE: Record<string, string> = {
  USER: "bg-sky-50 text-sky-700", SAATHI: "bg-emerald-50 text-emerald-700", SYSTEM: "bg-slate-100 text-slate-500", TOOL: "bg-amber-50 text-amber-700",
  DATA: "bg-violet-50 text-violet-700", SUPPLIER: "bg-orange-50 text-orange-700", MERCHANT: "bg-orange-50 text-orange-700", CALLER: "bg-rose-50 text-rose-700",
};

export function DemoStrip({ demo, onScenario }: { demo: any; onScenario: (id: number) => void }) {
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => { feed.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [demo?.narration?.length]);
  if (!demo || demo.status === "idle") return null;
  const lines = (demo.narration || []).filter((n: any) => !n.banner).slice(-14);
  const done = demo.scenarios.filter((s: any) => s.status === "done").length;
  const running = demo.status === "running";
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className={clsx("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
            running ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")}>
            {running && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 live-dot" />}
            {running ? "Live demo" : demo.status === "complete" ? "Demo complete" : "Demo stopped"}
          </span>
          <span className="text-[12.5px] capitalize text-slate-500">{demo.mode} mode · {done}/{demo.scenarios.length} scenarios</span>
        </div>
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-700" style={{ width: `${(done / demo.scenarios.length) * 100}%` }} />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-5 py-3">
        {demo.scenarios.map((s: any) => (
          <button key={s.id} onClick={() => onScenario(s.id)} disabled={running} title={`Replay demo ${s.id}: ${s.subtitle}`}
            className={clsx("flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition",
              s.status === "running" && "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm",
              s.status === "done" && "border-emerald-100 bg-white text-emerald-700",
              s.status === "error" && "border-rose-200 bg-rose-50 text-rose-600",
              s.status === "pending" && "border-slate-200 bg-white text-slate-400")}>
            {s.status === "running" ? <Loader2 size={13} className="animate-spin" /> : s.status === "done" ? <CheckCircle2 size={13} /> :
              s.status === "error" ? <XCircle size={13} /> : <CircleDashed size={13} />}
            {s.id}. {s.title}
          </button>
        ))}
      </div>
      <div ref={feed} className="max-h-[168px] space-y-1.5 overflow-y-auto bg-slate-50/60 px-5 py-3">
        {lines.map((n: any, i: number) => (
          <div key={i} className="flex animate-slideUp items-start gap-2.5 text-[12.5px]">
            <span className={clsx("mt-px w-[78px] shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold", SPEAKER_STYLE[n.speaker] || "bg-slate-100 text-slate-500")}>{n.speaker}</span>
            <span className={clsx("text-slate-700", n.verified && "font-semibold text-emerald-700")}>{n.text}{n.verified && " ✓"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ImpactModal({ demo, onClose }: { demo: any; onClose: () => void }) {
  if (!demo?.impact) return null;
  const all = demo.impact.flatMap((g: any) => g.items);
  const done = all.filter((i: any) => i.done).length;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/30 p-6 backdrop-blur-sm animate-slideUp">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white bg-white p-8 shadow-2xl">
        <button onClick={onClose} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        <div className="text-center">
          <div className="text-xs font-bold tracking-[0.3em] text-emerald-600">SAATHI AI</div>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-slate-900 md:text-4xl">
            DON'T JUST TELL ME WHAT HAPPENED.<br /><span className="bg-gradient-to-r from-emerald-600 to-amber-500 bg-clip-text text-transparent">HELP ME FIX IT.</span>
          </h2>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={15} /> {done} of {all.length} outcomes completed and verified against backend state
          </div>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {demo.impact.map((g: any) => (
            <div key={g.group} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="label mb-2">{g.group}</div>
              {g.items.map((i: any) => (
                <div key={i.label} className="flex items-center gap-2 py-1 text-[13.5px]">
                  {i.done ? <CheckCircle2 size={16} className="shrink-0 text-emerald-500" /> : <CircleDashed size={16} className="shrink-0 text-slate-300" />}
                  <span className={i.done ? "text-slate-800" : "text-slate-400"}>{i.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold tracking-wider">
          {["UNDERSTAND", "ANALYZE", "RECOMMEND", "APPROVE", "EXECUTE", "VERIFY", "MEASURE"].map((s) => (
            <div key={s} className="rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-emerald-700">{s}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
