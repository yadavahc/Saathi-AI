"use client";
import clsx from "clsx";
import { Camera, Mic, PhoneCall, PlayCircle, ShieldAlert, Square, Upload } from "lucide-react";
import { useRef, useState } from "react";
import ApprovalCard from "@/components/ApprovalCard";
import { Badge, Empty, Panel, Status } from "@/components/ui";
import { DocFindings, SAMPLES } from "@/components/user/Snap";
import { shrinkImage, useShieldAudio, useShieldMic } from "@/hooks/useShield";
import { api } from "@/services/api";
import { time } from "@/services/format";
import type { Ctx } from "./types";

const VERDICT = {
  SAFE: { text: "text-emerald-700", bar: "bg-emerald-400", border: "border-emerald-200" },
  SUSPICIOUS: { text: "text-amber-700", bar: "bg-amber-400", border: "border-amber-300" },
  SCAM: { text: "text-rose-600", bar: "bg-rose-500", border: "border-rose-300" },
} as const;

export function ShieldView(ctx: Ctx) {
  const sessions = ctx.data?.shield || [];
  const s = sessions[0];
  const live = s?.status === "LISTENING";
  const v = VERDICT[(s?.verdict || "SAFE") as keyof typeof VERDICT];
  const phoneReady = ctx.data?.integrations?.vobiz?.status === "live";
  useShieldAudio(s, ctx.voiceOn);
  const mic = useShieldMic(s?.session_id || null, !!s && live && s.source === "mic");
  const approvals = (s?.approval_ids || []).map((id: string) => (ctx.data?.approvals || []).find((a: any) => a.approval_id === id)).filter(Boolean);

  async function start(source: "simulation" | "mic" | "phone", scenario?: string) {
    try { await api.shieldStart(source, scenario); } catch (e: any) { alert(e.message); }
    ctx.refresh();
  }

  return (
    <div className="space-y-4">
      <Panel title="Scam Shield — SAATHI listens to a suspicious call and warns live" icon={<ShieldAlert size={15} />}
        right={
          <div className="flex flex-wrap gap-2">
            <button disabled={live} className="btn-danger !py-1.5 !text-xs" onClick={() => start("simulation", "digital_arrest")}><PlayCircle size={13} /> 'Digital arrest' scam</button>
            <button disabled={live} className="btn-ghost !py-1.5 !text-xs" onClick={() => start("simulation", "kyc_fraud")}><PlayCircle size={13} /> KYC scam (Kannada)</button>
            <button disabled={live} className="btn-ghost !py-1.5 !text-xs" onClick={() => start("simulation", "safe_call")}><PlayCircle size={13} /> Genuine call</button>
            <button disabled={live} className="btn-ghost !py-1.5 !text-xs" onClick={() => start("mic")}><Mic size={13} /> Speakerphone</button>
            {phoneReady && <button disabled={live} className="btn-primary !py-1.5 !text-xs" onClick={() => start("phone")}><PhoneCall size={13} /> Protect a phone call</button>}
          </div>
        }>
        {!s ? (
          <Empty>Start a demo scam call, listen on speakerphone, or protect a real phone call (SAATHI calls you; merge the suspicious call into it).</Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
            <div className="space-y-3">
              <div className={clsx("rounded-2xl border bg-slate-50 p-4", v.border)}>
                <div className="flex items-center justify-between">
                  <span className="label">Risk</span>
                  <Badge tone={s.verdict === "SCAM" ? "red" : s.verdict === "SUSPICIOUS" ? "amber" : "green"}>{s.verdict}</Badge>
                </div>
                <div className={clsx("mt-1 text-5xl font-black tabular-nums", v.text)}>{s.risk}<span className="text-lg text-slate-500">/100</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={clsx("h-full rounded-full transition-all duration-700", v.bar)} style={{ width: `${s.risk}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  <div><div className="label !text-[9.5px]">Rules</div><div className="font-semibold">{s.rule_score}/100</div></div>
                  <div><div className="label !text-[9.5px]">Claude</div><div className="font-semibold">{s.ai ? `${Math.round(s.ai.scam_probability * 100)}/100` : "…"}</div></div>
                  <div><div className="label !text-[9.5px]">Caller</div><div className="font-semibold">{s.caller}</div></div>
                  <div><div className="label !text-[9.5px]">Source</div><div className="font-semibold capitalize">{s.source}{s.stream ? ` · ${s.stream}` : ""}</div></div>
                </div>
                {s.source === "mic" && live && <div className="mt-2 text-[11.5px] text-slate-500">{mic.error || `${mic.heard} clips transcribed`}</div>}
                {live && (
                  <button className="btn-ghost mt-3 w-full !py-1.5 !text-xs" onClick={async () => { await api.shieldEnd(s.session_id); ctx.refresh(); }}>
                    <Square size={12} /> Stop listening
                  </button>
                )}
              </div>
              {s.ai && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-[12.5px]">
                  <div className="label mb-1 !text-violet-700">Claude's read · {s.ai.scam_type.replace(/_/g, " ")}</div>
                  <p className="text-slate-700">{s.ai.explanation}</p>
                  <p className="mt-2 font-semibold text-violet-700">→ {s.ai.advice}</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {s.warnings?.map((w: any, i: number) => (
                <div key={i} className={clsx("animate-slideUp rounded-2xl p-3.5", w.level === "SCAM" ? "bg-rose-500 text-white" : "bg-amber-400 text-amber-950")}>
                  <div className="text-[14px] font-bold">{w.text}</div>
                  <div className="text-[12.5px] opacity-85">{w.english} · spoken in Kannada{s.source === "phone" ? " into the call" : ""}</div>
                </div>
              ))}
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="label mb-2">Live transcript</div>
                  <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
                    {(s.transcript || []).map((t: any, i: number) => (
                      <div key={i} className={clsx("animate-slideUp rounded-xl px-3 py-2 text-[12.5px]", t.speaker === "USER" ? "ml-6 bg-sky-100" : "mr-6 bg-slate-100")}>
                        <span className="mr-1.5 text-[10px] font-bold uppercase text-slate-500">{t.speaker === "USER" ? "Rahul" : "Caller"}</span>{t.text}
                      </div>
                    ))}
                    {!s.transcript?.length && <div className="text-[12px] text-slate-500">Waiting for audio…</div>}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="label mb-2">Red flags (explainable rules)</div>
                  <div className="space-y-1.5">
                    {(s.signals || []).map((g: any) => (
                      <div key={g.id} className="animate-slideUp rounded-xl bg-rose-50 px-3 py-2 text-[12.5px]">
                        <div className="flex items-center justify-between"><span className="font-semibold text-rose-600">🚩 {g.label}</span><span className="text-slate-500">+{g.weight}</span></div>
                        <div className="text-[11.5px] text-slate-500">heard: “{g.match}”</div>
                      </div>
                    ))}
                    {!s.signals?.length && <div className="text-[12px] text-slate-500">No red flags yet.</div>}
                  </div>
                </div>
              </div>
              {approvals.length > 0 && (
                <div className="grid gap-2 lg:grid-cols-3">
                  {approvals.map((a: any) => <ApprovalCard key={a.approval_id} a={a} onApprove={ctx.approve} onReject={ctx.reject} />)}
                </div>
              )}
            </div>
          </div>
        )}
      </Panel>
      {sessions.length > 1 && (
        <Panel title="Recent sessions">
          {sessions.slice(1).map((x: any) => (
            <div key={x.session_id} className="flex items-center justify-between border-b border-slate-200 py-2 text-[12.5px] last:border-0">
              <span className="font-mono text-slate-500">{x.session_id}</span>
              <span>{x.caller} · {x.source}</span>
              <span className="tabular-nums">{x.risk}/100</span>
              <Status value={x.verdict === "SAFE" ? "OK" : x.verdict === "SCAM" ? "HIGH" : "MEDIUM"} />
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}

export function SnapView(ctx: Ctx) {
  const docs = ctx.data?.documents || [];
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  async function upload(f: File) {
    setBusy("upload");
    try { await api.snapUpload(await shrinkImage(f), "M001", "control_room"); } catch (e: any) { alert(e.message); }
    setBusy(null); ctx.refresh();
  }
  async function sample(id: string) {
    setBusy(id);
    try { await api.snapSample(id, "control_room"); } catch (e: any) { alert(e.message); }
    setBusy(null); ctx.refresh();
  }

  return (
    <div className="space-y-4">
      <Panel title="Snap & Act — a photo of paper becomes verified actions" icon={<Camera size={15} />}>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); e.dataTransfer.files[0] && upload(e.dataTransfer.files[0]); }}
            onClick={() => file.current?.click()}
            className={clsx("grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-8 text-center transition",
              drag ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-slate-300")}>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <div>
              <Upload className="mx-auto text-slate-500" />
              <div className="mt-2 text-[14px] font-semibold">{busy === "upload" ? "Reading photo…" : "Drop a photo or click to upload"}</div>
              <div className="text-[12px] text-slate-500">Khata page · supplier bill · shelf. Also works by sending a photo to the Telegram bot.</div>
            </div>
          </div>
          <div>
            <div className="label mb-2">Samples</div>
            <div className="grid grid-cols-3 gap-3">
              {SAMPLES.map((s) => (
                <button key={s.id} onClick={() => sample(s.id)} disabled={!!busy}
                  className={clsx("overflow-hidden rounded-xl border text-left transition hover:border-slate-300", busy === s.id ? "border-emerald-400 ring-2 ring-emerald-200" : "border-slate-200")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.src} alt={s.label} className="h-28 w-full object-cover" />
                  <div className="flex items-center justify-between px-2.5 py-2 text-[12px] font-semibold">{s.label}{busy === s.id && <span className="text-emerald-700">reading…</span>}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>
      {docs.length === 0 ? <Empty>No photos processed yet.</Empty> : docs.map((d: any) => {
        const approvals = (ctx.data?.approvals || []).filter((a: any) => (d.approval_ids || []).includes(a.approval_id));
        return (
          <Panel key={d.doc_id} title={<span className="flex items-center gap-2">{d.doc_id} · {d.doc_type.replace("_", " ")} <Badge tone="slate">{d.source}</Badge>
            <Badge tone={d.extraction?.engine === "claude-vision" ? "violet" : "slate"}>{d.extraction?.engine || "—"}</Badge></span>}
            right={<span className="flex items-center gap-2 text-[11px] text-slate-500">{time(d.created_at)} <Status value={d.status} /></span>}>
            <div className="grid gap-4 lg:grid-cols-[200px_1fr_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.image_url} alt="" className="max-h-56 w-full rounded-xl border border-slate-200 object-contain" />
              <div>
                <div className="text-[14px] font-semibold">{d.reply}</div>
                <div className="text-[12.5px] text-slate-500">{d.reply_en}</div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700"><DocFindings doc={d} dark /></div>
              </div>
              <div className="space-y-2">{approvals.map((a: any) => <ApprovalCard key={a.approval_id} a={a} onApprove={ctx.approve} onReject={ctx.reject} />)}</div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
