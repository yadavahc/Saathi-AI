"use client";
import clsx from "clsx";
import { Fragment } from "react";

const NODES = ["USER", "VOICE / TEXT", "INTENT", "AGENT", "DATA", "REASONING", "APPROVAL", "TOOL", "ACTION", "RESULT"];
const STAGE_TO_NODE: Record<string, number> = { SAID: 1, UNDERSTOOD: 3, DATA: 4, DECIDED: 5, APPROVAL: 6, TOOL: 7, ACTION: 8, VERIFIED: 9 };

export default function LiveAgentFlow({ run }: { run: any }) {
  const active = !run ? -1 : run.status === "COMPLETED" ? NODES.length : STAGE_TO_NODE[run.stage] ?? 0;
  const waiting = run?.status === "AWAITING_APPROVAL";
  return (
    <div className="flex items-center overflow-x-auto py-1">
      {NODES.map((node, i) => {
        const done = i < active;
        const isActive = i === active;
        return (
          <Fragment key={node}>
            <div className={clsx(
              "shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tracking-wider transition-all duration-500",
              done && "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
              isActive && (waiting ? "border-amber-400/70 bg-amber-400/15 text-amber-200 animate-pulseRing" : "border-brand-400/80 bg-brand-400/20 text-brand-200 animate-pulseRing"),
              !done && !isActive && "border-white/[0.07] text-slate-600",
            )}>
              {node}
            </div>
            {i < NODES.length - 1 && (
              <div className="relative mx-1 h-[2px] min-w-[14px] flex-1 overflow-hidden rounded bg-white/[0.06]">
                {i < active && <div className="absolute inset-0 flow-line" />}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
