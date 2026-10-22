"use client";
import { useEffect, useState } from "react";
import Login, { ACCOUNTS } from "@/components/user/Login";
import UserApp from "@/components/user/UserApp";

const KEY = "saathi_user";

export default function UserAppPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Remember who is signed in on this device (convenience only).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved && ACCOUNTS.some((a) => a.id === saved)) setUserId(saved);
    } catch { /* storage unavailable — show login */ }
    setReady(true);
  }, []);

  function signIn(id: string) {
    try { window.localStorage.setItem(KEY, id); } catch { /* ignore */ }
    setUserId(id);
  }

  function signOut() {
    try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    setUserId(null);
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#e9e7e1] text-stone-900 [color-scheme:light]">
      <div className="mx-auto min-h-full max-w-[440px] bg-[#f7f6f2] shadow-[0_0_80px_-20px_rgba(0,0,0,.25)]">
        {ready && (userId ? <UserApp userId={userId} onSignOut={signOut} /> : <Login onSignIn={signIn} />)}
      </div>
    </div>
  );
}
