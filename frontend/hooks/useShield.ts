"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";

/** Plays each new audio line of a Scam Shield session once, in order. Warnings cut in. */
export function useShieldAudio(session: any, enabled: boolean) {
  const queue = useRef<string[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const current = useRef<HTMLAudioElement | null>(null);

  function next() {
    const url = queue.current.shift();
    if (!url) { current.current = null; return; }
    const audio = new Audio(url);
    current.current = audio;
    audio.onended = next;
    audio.onerror = next;
    audio.play().catch(next);
  }

  useEffect(() => {
    if (!session || !enabled) return;
    for (const w of session.warnings || []) {
      if (w.audio_url && !seen.current.has(w.audio_url)) {
        seen.current.add(w.audio_url);
        current.current?.pause();
        queue.current.unshift(w.audio_url);
        next();
      }
    }
    for (const t of session.transcript || []) {
      if (t.audio_url && !seen.current.has(t.audio_url)) {
        seen.current.add(t.audio_url);
        queue.current.push(t.audio_url);
        if (!current.current) next();
      }
    }
  }, [session, enabled]);

  useEffect(() => () => { current.current?.pause(); queue.current = []; }, []);
}

/** Speakerphone mode: records standalone ~6 s clips (each with its own header) and uploads them. */
export function useShieldMic(sessionId: string | null, active: boolean) {
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState(0);
  const stopRef = useRef(false);

  useEffect(() => {
    if (!sessionId || !active) return;
    stopRef.current = false;
    let stream: MediaStream | null = null;

    async function loop() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setError("Microphone unavailable — try the demo scam call instead.");
        return;
      }
      while (!stopRef.current) {
        const blob = await new Promise<Blob>((resolve) => {
          const rec = new MediaRecorder(stream!);
          const parts: Blob[] = [];
          rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
          rec.onstop = () => resolve(new Blob(parts, { type: rec.mimeType || "audio/webm" }));
          rec.start();
          setTimeout(() => rec.state !== "inactive" && rec.stop(), 6000);
        });
        if (stopRef.current) break;
        api.shieldAudio(sessionId!, blob).then((r) => r.transcript && setHeard((n) => n + 1)).catch(() => undefined);
      }
    }
    loop();
    return () => {
      stopRef.current = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [sessionId, active]);

  return { error, heard };
}

/** Shrink a camera photo before upload (phones produce 4–12 MP images). */
export async function shrinkImage(file: Blob, max = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.85));
}
