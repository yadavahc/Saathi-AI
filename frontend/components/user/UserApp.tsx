"use client";
import clsx from "clsx";
import { Bell, CheckCircle2, Clock3, Home, ListChecks, LogOut, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Persona } from "@/services/api";
import { inr, time } from "@/services/format";
import Ask, { Reply } from "./Ask";
import { LakshmiHome, RahulHome } from "./Homes";
import { ApprovalTile, CallOverlay, Card, Pill, Section, friendlyStatus } from "./parts";
import { ShieldCard, ShieldScreen } from "./Shield";
import { SnapCard } from "./Snap";

const LANGS = [
  { id: "auto", label: "Auto" },
  { id: "en", label: "English" },
  { id: "kanglish", label: "Kanglish" },
  { id: "kn", label: "ಕನ್ನಡ" },
  { id: "hinglish", label: "Hinglish" },
  { id: "hi", label: "हिंदी" },
];

const SUGGESTIONS: Record<string, string[]> = {
  consumer: ["Will my payments go through?", "I need ₹80,000 urgently for hospital", "Any suspicious transaction?", "20 notebooks + 10 pens tomorrow under ₹2,000"],
  merchant: ["Aaj business hegide?", "Rice stock check maadi", "Ramesh ge reminder kalisu", "Evening sales are down — any idea?"],
};

function useUserData(userId: string) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setData(await api.userApp(userId)); setError(null); } catch (e: any) { setError(e.message); }
  }, [userId]);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => { await refresh(); if (!stop) timer = setTimeout(loop, 1500); };
    loop();
    return () => { stop = true; clearTimeout(timer); };
  }, [refresh]);
  return { data, error, refresh };
}

export default function UserApp({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const { data, error, refresh } = useUserData(userId);
  const [tab, setTab] = useState<"home" | "approvals" | "activity">("home");
  const [language, setLanguage] = useState("auto");
  const [voiceOn, setVoiceOn] = useState(true);
  const [reply, setReply] = useState<Reply>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [shieldId, setShieldId] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  if (!data) {
    return <div className="grid min-h-screen place-items-center text-[14px] text-stone-500">{error ? `Can't reach SAATHI (${error})` : "Loading…"}</div>;
  }

  const persona: Persona = data.user.role === "merchant" ? "merchant" : "consumer";
  const pending = data.pending || [];

  async function openShield(source: "simulation" | "mic" | "phone", scenario?: string) {
    try {
      const s = await api.shieldStart(source, scenario, userId);
      setShieldId(s.session_id);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }

  const shield = data.shield && (data.shield.status === "LISTENING" || data.shield.session_id === shieldId) ? data.shield : null;

  function ask(prompt: string) {
    setTab("home");
    setAsking(prompt);
    top.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="relative min-h-screen pb-28">
      <div ref={top} />
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-[#f7f6f2]/90 px-5 pb-3 pt-5 backdrop-blur">
        <div className={clsx("grid h-11 w-11 place-items-center rounded-2xl text-[17px] font-bold text-white",
          persona === "merchant" ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gradient-to-br from-emerald-500 to-teal-600")}>
          {data.user.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-stone-500">Namaskara 🙏</div>
          <div className="truncate text-[18px] font-extrabold leading-tight">{data.user.name}</div>
        </div>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Reply language"
          className="rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-[12.5px] font-semibold text-stone-700 outline-none">
          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <button onClick={() => setVoiceOn(!voiceOn)} aria-label="Voice replies" className="grid h-9 w-9 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600">
          {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button onClick={onSignOut} aria-label="Sign out" className="grid h-9 w-9 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600">
          <LogOut size={16} />
        </button>
      </header>

      <main className="space-y-6 px-5 pt-1">
        {tab === "home" && (
          <>
            <AskWithPrefill key={asking || "ask"} prefill={asking} clearPrefill={() => setAsking(null)} persona={persona} language={language}
              voiceOn={voiceOn} reply={reply} setReply={setReply} onDone={refresh} />
            {persona === "consumer" ? <ShieldCard phoneReady={!!data.phone_ready} onOpen={openShield} /> : <SnapCard docs={data.documents} onDone={refresh} />}
            {pending.length > 0 && (
              <Section title="Waiting for your OK" action={<Pill tone="amber">{pending.length}</Pill>}>
                <div className="space-y-3">{pending.map((a: any) => <ApprovalTile key={a.approval_id} a={a} onDone={refresh} />)}</div>
              </Section>
            )}
            {persona === "consumer" ? <RahulHome d={data} onAsk={ask} /> : <LakshmiHome d={data} onAsk={ask} />}
          </>
        )}

        {tab === "approvals" && (
          <div className="space-y-6">
            <Section title="Waiting for your OK">
              {pending.length === 0 ? (
                <Card className="text-center text-[14px] text-stone-500">Nothing needs your approval right now. ✨</Card>
              ) : (
                <div className="space-y-3">{pending.map((a: any) => <ApprovalTile key={a.approval_id} a={a} onDone={refresh} />)}</div>
              )}
            </Section>
            <div className="rounded-2xl bg-stone-100 px-4 py-3 text-[13px] leading-relaxed text-stone-600">
              🔒 SAATHI never moves money, sends messages or places orders without your OK. You can also approve from Telegram.
            </div>
          </div>
        )}

        {tab === "activity" && <Activity d={data} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[440px] border-t border-stone-200 bg-white/95 px-6 pb-5 pt-2 backdrop-blur">
        <div className="grid grid-cols-3">
          {([["home", "Home", Home], ["approvals", "Approvals", ListChecks], ["activity", "Activity", Clock3]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={clsx("relative flex flex-col items-center gap-0.5 py-1.5 text-[11.5px] font-semibold",
              tab === id ? "text-emerald-700" : "text-stone-400")}>
              <Icon size={21} />
              {label}
              {id === "approvals" && pending.length > 0 && (
                <span className="absolute right-[30%] top-0 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{pending.length}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {data.call && <CallOverlay call={data.call} voiceOn={voiceOn} onChange={refresh} />}
      {shield && !data.call && (
        <ShieldScreen session={shield} pending={pending} voiceOn={voiceOn} onChange={refresh} onClose={() => setShieldId(null)} />
      )}
    </div>
  );
}

/** Lets cards elsewhere on the page ("Fix it", "Remind") send a question through the same Ask box. */
function AskWithPrefill({ prefill, clearPrefill, persona, language, voiceOn, reply, setReply, onDone }: {
  prefill: string | null; clearPrefill: () => void; persona: Persona; language: string; voiceOn: boolean;
  reply: Reply; setReply: (r: Reply) => void; onDone: () => void;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (!prefill || sent.current) return;
    sent.current = true;
    setReply({ you: prefill, text: "", approvals: 0 });
    api.chat(prefill, persona, voiceOn, language)
      .then((r) => {
        setReply({ you: prefill, text: r.reply, audio: r.audio_url, approvals: r.approvals?.length || 0 });
        if (voiceOn && r.audio_url) import("@/hooks/useRecorder").then((m) => m.playAudio(r.audio_url, true));
        onDone();
      })
      .catch((e) => setReply({ you: prefill, text: `Sorry — ${e.message}`, approvals: 0 }))
      .finally(clearPrefill);
  }, [prefill]);
  return <Ask persona={persona} language={language} voiceOn={voiceOn} suggestions={SUGGESTIONS[persona]} reply={reply} setReply={setReply} onDone={onDone} />;
}

function Activity({ d }: { d: any }) {
  const items = d.history || [];
  return (
    <div className="space-y-6">
      <Section title="What SAATHI did for you">
        {items.length === 0 ? (
          <Card className="text-center text-[14px] text-stone-500">No actions yet. Ask SAATHI something on the Home tab.</Card>
        ) : (
          <div className="relative space-y-3 pl-5">
            <div className="absolute bottom-2 left-[7px] top-2 w-px bg-stone-200" />
            {items.map((a: any) => {
              const s = friendlyStatus(a.status);
              return (
                <div key={a.approval_id} className="relative">
                  <span className={clsx("absolute -left-5 top-4 h-3.5 w-3.5 rounded-full border-2 border-white",
                    a.status === "EXECUTED" ? "bg-emerald-500" : a.status === "REJECTED" ? "bg-stone-300" : "bg-amber-400")} />
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[14.5px] font-semibold leading-snug">{a.description}</div>
                      <Pill tone={s.tone}>{s.label}</Pill>
                    </div>
                    {a.result?.summary && (
                      <div className="mt-2 flex items-start gap-1.5 text-[13px] text-stone-600">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />{a.result.summary}
                      </div>
                    )}
                    <div className="mt-1.5 text-[11.5px] text-stone-400">{time(a.created_at)}{a.amount != null && ` · ${inr(a.amount)}`}</div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {d.last_call && (
        <Section title="Last safety call">
          <Card>
            <div className="flex items-center gap-2 text-[14px] font-semibold"><Bell size={15} className="text-emerald-600" /> {d.last_call.reason.toLowerCase()} · {d.last_call.language}</div>
            <div className="mt-2 space-y-1.5">
              {d.last_call.transcript.map((t: any, i: number) => (
                <div key={i} className={clsx("text-[13px]", t.speaker === "USER" ? "text-sky-700" : "text-stone-700")}>
                  <b>{t.speaker === "USER" ? "You" : "SAATHI"}:</b> {t.text}
                </div>
              ))}
            </div>
          </Card>
        </Section>
      )}
    </div>
  );
}
