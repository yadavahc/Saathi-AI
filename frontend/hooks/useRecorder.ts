"use client";
import { useRef, useState } from "react";

/** Push-to-talk microphone capture → webm Blob (sent to Sarvam STT by the backend). */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setError("Microphone unavailable — type instead.");
    }
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = recorder.current;
      if (!rec) return resolve(null);
      rec.onstop = () => {
        rec.stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        resolve(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
      };
      rec.stop();
    });
  }

  return { recording, error, start, stop };
}

let current: HTMLAudioElement | null = null;
const played = new Set<string>();

/** Play a Sarvam audio URL once (subsequent calls with the same URL are ignored unless forced). */
export function playAudio(url?: string | null, force = false) {
  if (!url || (!force && played.has(url))) return;
  played.add(url);
  try {
    current?.pause();
    current = new Audio(url);
    current.play().catch(() => undefined);
  } catch {
    /* audio is best-effort */
  }
}

export function markPlayed(url?: string | null) {
  if (url) played.add(url);
}
