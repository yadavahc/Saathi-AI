import type { Metadata } from "next";
import Landing from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "SAATHI AI — Don't just tell me what happened. Help me fix it.",
  description: "A multilingual AI agent that understands you in Kannada, Hindi or English, reasons over your money and business data, asks before it acts — then calls, orders, blocks and verifies.",
};

export default function Home() {
  return <Landing />;
}
