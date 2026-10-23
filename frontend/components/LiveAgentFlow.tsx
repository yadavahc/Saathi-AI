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
              done && "border-emerald-200 bg-emerald-50 text-emerald-700",
              isActive && (waiting ? "border-amber-300 bg-amber-100 text-amber-700 animate-pulseRing" : "border-emerald-300 bg-emerald-100 text-emerald-700 animate-pulseRing"),
              !done && !isActive && "border-slate-200 text-slate-400",
            )}>
              {node}
            </div>
            {i < NODES.length - 1 && (
              <div className="relative mx-1 h-[2px] min-w-[14px] flex-1 overflow-hidden rounded bg-slate-100">
                {i < active && <div className="absolute inset-0 flow-line" />}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
