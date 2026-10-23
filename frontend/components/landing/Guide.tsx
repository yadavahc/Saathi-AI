"use client";
import clsx from "clsx";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform, useVelocity } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/*
 * Saathi, the cartoon guide. He walks in below the hero and travels along the page margins as the
 * visitor scrolls — facing, stepping and leaning from his real motion. He stays out of the hero;
 * closing him sends him off-screen until "Bring Saathi back" (preference remembered per browser).
 */

type Pose = "idle" | "wave" | "point" | "think" | "cheer" | "alarm";
type Side = "left" | "right";
const STOPS: Record<string, { line: string; pose: Pose; side: Side }> = {
  top: { line: "Namaskara! Naanu Saathi 👋", pose: "wave", side: "right" },
  demo: { line: "Watch me work ▶", pose: "point", side: "left" },
  gap: { line: "Data isn't enough. Action is.", pose: "think", side: "right" },
  loop: { line: "Your words → a verified result", pose: "point", side: "left" },
  features: { line: "Six agents. One Saathi!", pose: "cheer", side: "right" },
  wow: { line: "I catch scams — live 🚨", pose: "alarm", side: "left" },
  stats: { line: "52 tools at your service", pose: "cheer", side: "right" },
  gallery: { line: "All real screens 👀", pose: "point", side: "left" },
  trust: { line: "Never your OTP. Promise 🤝", pose: "wave", side: "right" },
  cta: { line: "Let's fix it together!", pose: "cheer", side: "left" },
};
const ORDER = Object.keys(STOPS);
const W = 160;
const H = 230;
const KEY = "saathi-guide";
const CONTENT = 1152;

const ARMS: Record<Pose, [number, number]> = {
  idle: [10, -10], wave: [12, -150], point: [12, -95], think: [12, 120], cheer: [150, -150], alarm: [160, -160],
};

function Boy({ pose, talking, walking }: { pose: Pose; talking: boolean; walking: boolean }) {
  const [l, r] = ARMS[pose];
  const arm = (deg: number, ox: number) => ({ transform: `rotate(${deg}deg)`, transformOrigin: `${ox}px 108px`, transition: "transform .55s cubic-bezier(.34,1.56,.64,1)" });
  const skin = "#e2a57c";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} overflow="visible" aria-hidden>
      <defs>
        <linearGradient id="gdHoodie" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#0d9488" /></linearGradient>
      </defs>
      <ellipse cx="80" cy="224" rx={walking ? 30 : 36} ry="6" fill="rgba(15,23,42,.14)" style={{ transition: "rx .3s" }} />
      <g className={walking ? "gd-run" : "gd-bob"}>
        {/* legs */}
        <g className={walking ? "gd-step-a" : ""} style={{ transformOrigin: "66px 150px" }}>
          <rect x="58" y="146" width="16" height="58" rx="8" fill="#3b5bdb" />
          <ellipse cx="63" cy="208" rx="15" ry="8" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
        </g>
        <g className={walking ? "gd-step-b" : ""} style={{ transformOrigin: "94px 150px" }}>
          <rect x="86" y="146" width="16" height="58" rx="8" fill="#364fc7" />
          <ellipse cx="97" cy="208" rx="15" ry="8" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
        </g>
        {/* body */}
        <rect x="44" y="96" width="72" height="66" rx="28" fill="url(#gdHoodie)" />
        <path d="M52 112 C56 104 62 100 70 99" stroke="rgba(255,255,255,.45)" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="80" cy="128" r="12" fill="#fff" />
        <text x="80" y="133" textAnchor="middle" fontSize="14" fontWeight="900" fill="#059669">स</text>
        {/* left arm */}
        <g style={arm(l, 50)}>
          <rect x="42" y="102" width="15" height="46" rx="7.5" fill="url(#gdHoodie)" />
          <circle cx="49.5" cy="150" r="8.5" fill={skin} />
        </g>
        {/* neck + head */}
        <rect x="73" y="86" width="14" height="14" rx="6" fill={skin} />
        <circle cx="44" cy="64" r="7.5" fill={skin} />
        <circle cx="116" cy="64" r="7.5" fill={skin} />
        <circle cx="80" cy="62" r="36" fill={skin} />
        <ellipse cx="66" cy="42" rx="11" ry="6" fill="rgba(255,255,255,.28)" />
        <path d="M44 60 C40 28 62 18 82 20 C106 20 122 34 116 62 C110 46 98 40 84 42 C68 38 54 46 44 60 Z" fill="#1f1a17" />
        <path d="M76 22 C78 8 94 6 98 16 C92 16 86 20 84 26 Z" fill="#1f1a17" />
        <path d="M60 51 L74 53" stroke="#1f1a17" strokeWidth="3" strokeLinecap="round" style={{ transform: pose === "alarm" ? "translateY(-3px)" : undefined, transition: "transform .3s" }} />
        <path d="M100 51 L86 53" stroke="#1f1a17" strokeWidth="3" strokeLinecap="round" style={{ transform: pose === "alarm" ? "translateY(-3px)" : undefined, transition: "transform .3s" }} />
        <g className="dv-blink">
          <ellipse cx="67" cy="64" rx="5.2" ry={pose === "alarm" ? 7 : 6.2} fill="#1e293b" />
          <ellipse cx="93" cy="64" rx="5.2" ry={pose === "alarm" ? 7 : 6.2} fill="#1e293b" />
        </g>
        <circle cx="69" cy="61.5" r="1.8" fill="#fff" />
        <circle cx="95" cy="61.5" r="1.8" fill="#fff" />
        <circle cx="58" cy="76" r="6" fill="#fb7185" opacity=".35" />
        <circle cx="102" cy="76" r="6" fill="#fb7185" opacity=".35" />
        {talking ? <ellipse className="dv-talk" cx="80" cy="82" rx="7" ry="5" fill="#7f1d1d" />
          : pose === "alarm" ? <ellipse cx="80" cy="83" rx="4.5" ry="5.5" fill="#7f1d1d" />
          : <path d="M69 78 Q80 90 91 78" stroke="#7f1d1d" strokeWidth="3.4" fill="#fecaca" strokeLinecap="round" />}
        {/* right arm (drawn last so waving / thinking sits in front) */}
        <g style={arm(r, 110)}>
          <g className={pose === "wave" ? "gd-wave" : ""} style={{ transformOrigin: "110px 108px" }}>
            <rect x="103" y="102" width="15" height="46" rx="7.5" fill="url(#gdHoodie)" />
            <circle cx="110.5" cy="150" r="8.5" fill={skin} />
          </g>
        </g>
      </g>
    </svg>
  );
}

export function Guide() {
  const [follow, setFollow] = useState(true);
  const [ready, setReady] = useState(false);
  const [stop, setStop] = useState("top");
  const [align, setAlign] = useState<"center" | Side>("right");
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState(1);
  const [talking, setTalking] = useState(true);
  const [poke, setPoke] = useState<string | null>(null);
  const followRef = useRef(true);
  const stopRef = useRef("top");
  const alignRef = useRef<"center" | Side>("right");
  const readyRef = useRef(false);

  const tx = useMotionValue(-400), ty = useMotionValue(-400), ts = useMotionValue(1);
  const x = useSpring(tx, { stiffness: 55, damping: 15, mass: 1 });
  const y = useSpring(ty, { stiffness: 75, damping: 14 });
  const s = useSpring(ts, { stiffness: 70, damping: 17 });
  const hop = useMotionValue(0);

  // scroll momentum: he dips and leans as the page moves
  const { scrollY } = useScroll();
  const sv = useSpring(useVelocity(scrollY), { stiffness: 60, damping: 20 });
  const lag = useTransform(sv, [-3000, 0, 3000], [-38, 0, 38]);
  const tilt = useTransform(sv, [-3000, 0, 3000], [-9, 0, 9]);
  const docked = follow && stop !== "top";
  const finalY = useTransform([y, lag, hop] as any, ([a, b, h]: number[]) => a + (docked ? b : 0) + h);
  const lean = useTransform(tilt, (v) => (docked ? v : 0));
  const bubbleBottom = useTransform(s, (v) => H * v + 8);

  const vx = useVelocity(x);
  useMotionValueEvent(vx, "change", (v) => {
    const moving = Math.abs(v) > 70;
    setWalking((w) => (w === moving ? w : moving));
    if (moving) setFacing(v > 0 ? 1 : -1);
  });
  useMotionValueEvent(sv, "change", (v) => {
    if (!docked) return;
    const running = Math.abs(v) > 1100;
    if (running) setWalking(true);
  });

  // remembered preference
  useEffect(() => {
    try { if (localStorage.getItem(KEY) === "off") { followRef.current = false; setFollow(false); } } catch {}
  }, []);

  // position: hero home, or a margin "dock" for the current section
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight, vw = window.innerWidth, mid = vh * 0.55;
      let cur = stopRef.current;
      for (const id of ORDER) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) { cur = id; break; }
      }
      if (cur !== stopRef.current) { stopRef.current = cur; setStop(cur); }
      let X: number, Y: number, S: number, A: Side;
      const side = STOPS[cur].side;
      const margin = (vw - CONTENT) / 2;
      if (margin >= 130) { S = 0.75; X = side === "left" ? margin / 2 : vw - margin / 2; Y = vh - 26; A = side; }
      else { S = vw < 640 ? 0.42 : 0.55; X = vw - (W * S) / 2 - 10; Y = vh - 8; A = "right"; }
      // hero, or switched off: wait just below the screen
      if (!followRef.current || cur === "top") Y = vh + H * S + 80;
      tx.set(X); ty.set(Y); ts.set(S);
      if (A !== alignRef.current) { alignRef.current = A; setAlign(A); }
      if (!readyRef.current) { x.jump(X); y.jump(Y); s.jump(S); }
      if (!readyRef.current) { readyRef.current = true; setReady(true); }
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    const t = setTimeout(update, 300);
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, [tx, ty, ts, x, y, s]);

  // talk for a moment whenever he arrives somewhere new
  useEffect(() => {
    setTalking(true);
    const t = setTimeout(() => setTalking(false), 1800);
    return () => clearTimeout(t);
  }, [stop, poke, follow]);

  const setFollowing = (on: boolean) => {
    followRef.current = on;
    setFollow(on);
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
    window.dispatchEvent(new Event("scroll"));
  };
  const onPoke = () => {
    animate(hop, [0, -46, 0], { duration: 0.55, ease: "easeOut" });
    setPoke("Hehe! Keep scrolling 👇");
    setTimeout(() => setPoke(null), 2200);
  };

  const cfg = STOPS[stop] || STOPS.top;
  const pose: Pose = !follow ? "wave" : poke ? "cheer" : cfg.pose;
  const line = poke || (!follow ? "Want me to guide you?" : cfg.line);
  const restingFace = align === "left" ? 1 : align === "right" ? -1 : 1;
  const face = walking ? facing : restingFace;
  const showRestore = !follow && stop !== "top";

  return (
    <>
      <motion.div className="pointer-events-none fixed left-0 top-0 z-40" style={{ x, y: finalY, opacity: ready ? 1 : 0 }}>
        {/* character (anchored at his feet) */}
        <motion.div className="pointer-events-auto absolute bottom-0 cursor-pointer" style={{ width: W, height: H, left: -W / 2, scale: s, rotate: lean, originX: 0.5, originY: 1 }}
          onClick={onPoke} title="Hi, I'm Saathi!">
          <div style={{ transform: `scaleX(${face})`, transition: "transform .35s ease" }}>
            <Boy pose={pose} talking={talking} walking={walking} />
          </div>
        </motion.div>
        {/* speech bubble */}
        <motion.div className="absolute" style={{ bottom: bubbleBottom }}>
          <AnimatePresence mode="wait">
            <motion.div key={line} initial={{ opacity: 0, scale: 0.6, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.7, y: 6 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className={clsx("pointer-events-auto absolute bottom-0 flex items-center gap-2 whitespace-nowrap rounded-2xl bg-white py-2 pl-3.5 pr-2 text-[13.5px] font-bold text-slate-800 shadow-[0_14px_30px_-12px_rgba(15,23,42,.45)] ring-1 ring-slate-100",
                align === "center" ? "left-0 -translate-x-1/2 origin-bottom" : align === "left" ? "-left-12 origin-bottom-left" : "-right-3 origin-bottom-right")}>
              {line}
              {follow ? (
                <button onClick={(e) => { e.stopPropagation(); setFollowing(false); }} aria-label="Stop Saathi from following" title="Stop following"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600"><X size={13} strokeWidth={3} /></button>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setFollowing(true); }}
                  className="rounded-full bg-emerald-500 px-2.5 py-1 text-[12px] font-bold text-white transition hover:bg-emerald-600">Yes!</button>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* bring him back once he has been dismissed and the hero is out of view */}
      <AnimatePresence>
        {showRestore && (
          <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={() => setFollowing(true)}
            className="clay-sm fixed bottom-5 left-5 z-40 flex items-center gap-2 !rounded-full py-2 pl-2 pr-4 text-[13px] font-bold text-slate-700">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white"><Sparkles size={14} /></span>
            Bring Saathi back
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
