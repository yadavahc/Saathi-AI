"use client";
import { ChevronRight, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";

export const ACCOUNTS = [
  { id: "U001", name: "Rahul", role: "Personal account", place: "Bengaluru", phone: "+91 98450 ·····", initial: "R",
    tint: "from-emerald-500 to-teal-600", blurb: "Payments, fraud protection, emergencies" },
  { id: "M001", name: "Lakshmi", role: "Lakshmi General Stores", place: "Mysuru", phone: "+91 99000 ·····", initial: "L",
    tint: "from-amber-500 to-orange-600", blurb: "Sales, stock, suppliers, customer dues" },
];

export default function Login({ onSignIn }: { onSignIn: (id: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  function choose(id: string) {
    setBusy(id);
    setTimeout(() => onSignIn(id), 450);
  }

  return (
    <div className="flex min-h-screen flex-col px-6 pb-8 pt-14">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-amber-500 text-2xl font-black text-white shadow-lg shadow-emerald-600/20">स</div>
        <div>
          <div className="text-xl font-extrabold tracking-tight">SAATHI</div>
          <div className="text-[13px] text-stone-500">Your money & business companion</div>
        </div>
      </div>

      <h1 className="mt-12 text-[28px] font-extrabold leading-tight tracking-tight">
        Don't just tell me what happened.<br /><span className="text-emerald-600">Help me fix it.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
        Talk to SAATHI in Kannada, Hindi or English. It checks your numbers, suggests what to do, and acts only when you approve.
      </p>

      <div className="mt-10 text-[12px] font-semibold uppercase tracking-[0.14em] text-stone-500">Choose an account</div>
      <div className="mt-3 space-y-3">
        {ACCOUNTS.map((a) => (
          <button key={a.id} onClick={() => choose(a.id)} disabled={!!busy}
            className="group flex w-full items-center gap-4 rounded-3xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[.99] disabled:opacity-70">
            <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${a.tint} text-xl font-bold text-white`}>{a.initial}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-bold">{a.name}</div>
              <div className="truncate text-[13px] text-stone-500">{a.role} · {a.place}</div>
              <div className="mt-0.5 truncate text-[12px] text-stone-400">{a.blurb}</div>
            </div>
            {busy === a.id ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            ) : (
              <ChevronRight className="text-stone-300 transition group-hover:text-stone-500" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-auto space-y-2 pt-10 text-[12.5px] text-stone-500">
        <div className="flex items-center gap-2"><Lock size={14} /> Demo accounts — no password needed.</div>
        <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-600" /> SAATHI will never ask for your OTP, PIN or CVV.</div>
      </div>
    </div>
  );
}
