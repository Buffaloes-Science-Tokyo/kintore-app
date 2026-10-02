"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TodayData = {
  sessions: { exercise: string; sets: { weightKg: number; reps: number }[]; volume: number }[];
  maxes: { exercise: string; weightKg: number | null; injured: boolean }[];
  weights: number[];
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** 記録ページに表示する「今日の実施メニュー」。記録が保存されるたびに自動更新される */
export default function TodayMenu({ memberId, memberName }: { memberId: number; memberName: string }) {
  const [data, setData] = useState<TodayData | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/today?member=${memberId}&date=${todayStr()}`);
      if (res.ok) setData(await res.json());
    } catch {
      // 読み込み失敗時は表示を更新しない
    }
  }, [memberId]);

  useEffect(() => {
    load();
    window.addEventListener("kintore-logged", load);
    return () => window.removeEventListener("kintore-logged", load);
  }, [load]);

  if (!data) return null;

  const isEmpty =
    data.sessions.length === 0 && data.maxes.length === 0 && data.weights.length === 0;

  return (
    <div className="card today-menu">
      <h2>📅 今日の {memberName} の実施メニュー</h2>
      {isEmpty ? (
        <p className="empty">今日はまだ記録がありません。1種目目からいきましょう 🔥</p>
      ) : (
        <>
          {data.sessions.length > 0 && (
            <ul className="today-list">
              {data.sessions.map((s) => (
                <li key={s.exercise}>
                  <b>{s.exercise}</b>
                  <span className="today-sets">
                    {s.sets.map((x) => `${x.weightKg}×${x.reps}`).join(" / ")}
                  </span>
                  <span className="today-vol">
                    {s.sets.length}セット・{Math.round(s.volume).toLocaleString()}kg
                  </span>
                  <Link
                    className="edit-link"
                    href={`/records/edit?${new URLSearchParams({
                      member: String(memberId),
                      date: todayStr(),
                      exercise: s.exercise,
                      from: "log",
                    })}`}
                  >
                    ✏️ 編集
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {(data.maxes.length > 0 || data.weights.length > 0) && (
            <p className="today-extra">
              {data.maxes
                .map((m) =>
                  m.weightKg != null
                    ? `💪 MAX ${m.exercise} ${m.weightKg}kg`
                    : `🩹 MAX ${m.exercise} 怪我のため測定なし`
                )
                .join("　")}
              {data.maxes.length > 0 && data.weights.length > 0 && "　"}
              {data.weights.map((w) => `⚖️ 体重 ${w}kg`).join("　")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
