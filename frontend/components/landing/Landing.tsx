"use client";
import Lenis from "lenis";
import { useEffect } from "react";
import { Background, CursorGlow, ScrollProgress } from "./Background";
import { DemoVideo } from "./DemoVideo";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { ActionGap, LanguageBand, Loop, Nav, Trust } from "./Sections";
import { FinalCTA, Footer, Gallery, Stats, Wow } from "./Showcase";

export default function Landing() {
  // Inertial smooth scrolling (skipped for users who prefer reduced motion).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const target = document.querySelector(a.getAttribute("href")!);
      if (target) { e.preventDefault(); lenis.scrollTo(target as HTMLElement, { offset: -20, duration: 1.4 }); }
    };
    document.addEventListener("click", onClick);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); document.removeEventListener("click", onClick); };
  }, []);

  return (
    <div className="landing relative min-h-screen overflow-x-clip text-slate-900">
      <Background />
      <CursorGlow />
      <ScrollProgress />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <LanguageBand />
        <DemoVideo />
        <ActionGap />
        <Loop />
        <Features />
        <Wow />
        <Stats />
        <Gallery />
        <Trust />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
