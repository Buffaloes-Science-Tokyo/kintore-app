// グラフ用の集計ロジック（サーバー側で実行）

export type Point = { t: number; value: number };

/** ピアソン相関係数。ペアが3組未満なら null */
export function pearson(pairs: [number, number][]): number | null {
  const n = pairs.length;
  if (n < 3) return null;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

/** MAX記録それぞれに、時間的に最も近いKPI値（±maxGapDays以内）を対応づけて相関を計算 */
export function correlateNearest(
  maxes: Point[],
  kpis: Point[],
  maxGapDays = 21
): { r: number | null; pairCount: number } {
  const gap = maxGapDays * 24 * 60 * 60 * 1000;
  const pairs: [number, number][] = [];
  for (const m of maxes) {
    let best: Point | null = null;
    let bestDist = Infinity;
    for (const k of kpis) {
      const d = Math.abs(k.t - m.t);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
    if (best && bestDist <= gap) pairs.push([m.value, best.value]);
  }
  return { r: pearson(pairs), pairCount: pairs.length };
}

function monthKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

/** 月ごとの合計セット数（1行=1セット）。tは月初 */
export function monthlySetCount(logs: { date: Date }[]): Point[] {
  const byMonth = new Map<number, number>();
  for (const log of logs) {
    const k = monthKey(log.date);
    byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
  }
  return [...byMonth.entries()]
    .map(([t, value]) => ({ t, value }))
    .sort((a, b) => a.t - b.t);
}

/** 月ごとの総トン数（重量×回数の合計をトン換算）。tは月初 */
export function monthlyTonnage(
  logs: { date: Date; weightKg: number; reps: number }[]
): Point[] {
  const byMonth = new Map<number, number>();
  for (const log of logs) {
    const k = monthKey(log.date);
    byMonth.set(k, (byMonth.get(k) ?? 0) + log.weightKg * log.reps);
  }
  return [...byMonth.entries()]
    .map(([t, value]) => ({ t, value: Math.round(value / 100) / 10 })) // トン、小数1桁
    .sort((a, b) => a.t - b.t);
}

export type PeriodKey = "3m" | "6m" | "1y" | "all";

export function periodStart(period: PeriodKey): Date | null {
  if (period === "all") return null;
  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

export function corrLabel(r: number | null): string {
  if (r === null) return "データ不足（重なる記録が3組未満）";
  const abs = Math.abs(r);
  const strength =
    abs >= 0.7 ? "強い" : abs >= 0.4 ? "中程度の" : abs >= 0.2 ? "弱い" : "ほぼ無";
  const dir = r >= 0 ? "正の" : "負の";
  return abs < 0.2 ? "ほぼ相関なし" : `${strength}${dir}相関`;
}
