"use client";
import clsx from "clsx";
import { Camera, ImageUp } from "lucide-react";
import { useRef, useState } from "react";
import { shrinkImage } from "@/hooks/useShield";
import { api } from "@/services/api";
import { inr } from "@/services/format";
import { Card, Pill } from "./parts";

export const SAMPLES = [
  { id: "khata", label: "Khata page", src: "/samples/khata.png" },
  { id: "bill", label: "Supplier bill", src: "/samples/bill.png" },
  { id: "shelf", label: "Shelf", src: "/samples/shelf.png" },
];
const TYPE_LABEL: Record<string, string> = { khata: "Khata page", supplier_bill: "Supplier bill", shelf: "Shelf photo", other: "Photo" };

export function DocFindings({ doc, dark = false }: { doc: any; dark?: boolean }) {
  const f = doc.findings || {};
  const muted = dark ? "text-slate-400" : "text-stone-500";
  if (f.khata) {
    return (
      <div className="space-y-1.5">
        {f.khata.changes.map((c: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-[13.5px]">
            <span className="font-semibold">{c.name}</span>
            <span className="tabular-nums">{c.kind === "new" ? <Pill tone="blue">new · {inr(c.amount)}</Pill> : <>{inr(c.old)} → <b>{inr(c.amount)}</b></>}</span>
          </div>
        ))}
        {f.khata.unchanged?.length > 0 && <div className={clsx("text-[12px]", muted)}>Already matching: {f.khata.unchanged.join(", ")}</div>}
      </div>
    );
  }
  if (f.match) {
    return (
      <div className="space-y-1.5">
        {f.match.lines.map((l: any, i: number) => (
          <div key={i} className="text-[13.5px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{l.name}</span>
              <span className="tabular-nums">{l.quantity} × {inr(l.unit_price)}</span>
            </div>
            {l.issue && <div className="text-[12.5px] font-semibold text-rose-600">⚠ {l.issue}</div>}
          </div>
        ))}
        <div className="flex justify-between border-t border-current/10 pt-1.5 text-[13.5px]">
          <span>Billed {inr(f.match.billed_total)}</span><span className="font-bold">Fair {inr(f.match.fair_total)}</span>
        </div>
      </div>
    );
  }
  if (f.shelf) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {f.shelf.items.map((s: any, i: number) => (
          <Pill key={i} tone={s.level === "empty" ? "red" : s.level === "low" ? "amber" : "green"}>{s.name}: {s.level}</Pill>
        ))}
      </div>
    );
  }
  return null;
}

/** Lakshmi's camera card: snap a khata page, bill or shelf. */
export function SnapCard({ docs, onDone }: { docs: any[]; onDone: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = docs?.[0];

  async function upload(f: File) {
    setError(null); setBusy("photo"); setPreview(URL.createObjectURL(f));
    try { await api.snapUpload(await shrinkImage(f)); onDone(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  }

  async function sample(id: string, src: string) {
    setError(null); setBusy(id); setPreview(src);
    try { await api.snapSample(id); onDone(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  }

  return (
    <Card className="!p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-600"><Camera size={22} /></span>
        <div>
          <div className="text-[16px] font-bold">Snap & Act</div>
          <div className="text-[13px] text-stone-500">Photo of your khata, a bill or a shelf — SAATHI does the rest.</div>
        </div>
      </div>
      <input ref={file} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button onClick={() => file.current?.click()} disabled={!!busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 py-3 text-[14px] font-bold text-white active:scale-[.98] disabled:opacity-60">
        <ImageUp size={17} /> Take or upload a photo
      </button>
      <div className="mt-3 text-[12px] font-medium text-stone-500">or try a sample</div>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {SAMPLES.map((s) => (
          <button key={s.id} onClick={() => sample(s.id, s.src)} disabled={!!busy}
            className={clsx("overflow-hidden rounded-2xl border bg-stone-50 text-left transition active:scale-[.97]", busy === s.id ? "border-sky-500 ring-2 ring-sky-300" : "border-stone-200")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.src} alt={s.label} className="h-20 w-full object-cover" />
            <div className="px-2 py-1.5 text-[11.5px] font-semibold">{s.label}</div>
          </button>
        ))}
      </div>
      {busy && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-sky-50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="" className="h-14 w-14 rounded-xl object-cover" />}
          <div className="flex items-center gap-2 text-[13.5px] font-medium text-sky-800">
            <span className="h-2 w-2 animate-ping rounded-full bg-sky-500" /> SAATHI is reading the photo…
          </div>
        </div>
      )}
      {error && <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</div>}
      {!busy && latest && (
        <div className="mt-4 rounded-2xl border border-stone-200 p-3">
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={latest.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5"><Pill tone="blue">{TYPE_LABEL[latest.doc_type] || "Photo"}</Pill>
                {latest.extraction?.engine === "claude-vision" && <Pill>read by AI</Pill>}</div>
              <div className="mt-1 text-[14px] font-semibold leading-snug">{latest.reply}</div>
              <div className="text-[12.5px] text-stone-500">{latest.reply_en}</div>
            </div>
          </div>
          <div className="mt-3"><DocFindings doc={latest} /></div>
          {latest.approval_ids?.length > 0 && latest.status === "ANALYZED" && (
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">↓ {latest.approval_ids.length} action(s) waiting for your OK</div>
          )}
        </div>
      )}
    </Card>
  );
}
