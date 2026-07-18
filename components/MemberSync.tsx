"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { loadCurrentMember } from "@/lib/currentMember";

/**
 * ホームで選択した部員（localStorage）をURLの ?member= に反映する。
 * サーバー側では member パラメータを見て本人の記録だけを表示する。
 */
export default function MemberSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("member")) return;
    const current = loadCurrentMember();
    if (!current) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("member", String(current.id));
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  return null;
}
