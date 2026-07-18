// 週単位の集計ヘルパー（週は月曜始まり・UTC基準）

export function mondayOf(d: Date): number {
  const day = (d.getUTCDay() + 6) % 7; // 月曜=0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

/** 今週を含む直近n週の週初め（古い順） */
export function lastWeeks(n: number): number[] {
  const thisMonday = mondayOf(new Date());
  return Array.from({ length: n }, (_, i) => thisMonday - (n - 1 - i) * 7 * 24 * 3600 * 1000);
}

export function weekLabel(t: number): string {
  const d = new Date(t);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}週`;
}
