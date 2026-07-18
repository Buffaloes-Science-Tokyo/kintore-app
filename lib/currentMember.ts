"use client";

import { useEffect, useState } from "react";

export type CurrentMember = { id: number; name: string; role: string };

const KEY = "kintore.currentMember";

export function loadCurrentMember(): CurrentMember | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CurrentMember) : null;
  } catch {
    return null;
  }
}

export function saveCurrentMember(member: CurrentMember | null) {
  if (member) {
    window.localStorage.setItem(KEY, JSON.stringify(member));
  } else {
    window.localStorage.removeItem(KEY);
  }
  window.dispatchEvent(new Event("kintore-member-changed"));
}

export function useCurrentMember(): CurrentMember | null {
  const [member, setMember] = useState<CurrentMember | null>(null);

  useEffect(() => {
    const sync = () => setMember(loadCurrentMember());
    sync();
    window.addEventListener("kintore-member-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("kintore-member-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return member;
}
