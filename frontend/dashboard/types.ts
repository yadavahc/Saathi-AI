import type { Persona } from "@/services/api";

export type Ctx = {
  data: any;
  ask: (text: string, persona: Persona) => void;
  setView: (v: string) => void;
  approve: (id: string) => void;
  reject: (id: string) => void;
  refresh: () => void;
  voiceOn: boolean;
  runId: string | null;
  setRunId: (id: string | null) => void;
};
