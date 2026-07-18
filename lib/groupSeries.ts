// グループ表示（ポジション・学年ごとの個人線＋平均線）用の月次集計

export type MemberInfo = { id: number; name: string };

function monthKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

export type GroupDatum = { t: number } & Record<string, number>;
export type SeriesKey = { key: string; name: string };

/** 部員ごとの月次体重（月内平均） */
export function monthlyWeightByMember(
  weights: { memberId: number; date: Date; weightKg: number }[]
): Map<number, Map<number, number>> {
  const agg = new Map<number, Map<number, { sum: number; n: number }>>();
  for (const w of weights) {
    const k = monthKey(w.date);
    let byMonth = agg.get(w.memberId);
    if (!byMonth) {
      byMonth = new Map();
      agg.set(w.memberId, byMonth);
    }
    const cur = byMonth.get(k) ?? { sum: 0, n: 0 };
    cur.sum += w.weightKg;
    cur.n += 1;
    byMonth.set(k, cur);
  }
  const result = new Map<number, Map<number, number>>();
  for (const [memberId, byMonth] of agg) {
    const m = new Map<number, number>();
    for (const [k, { sum, n }] of byMonth) {
      m.set(k, Math.round((sum / n) * 10) / 10);
    }
    result.set(memberId, m);
  }
  return result;
}

/**
 * 部員ごとの月次MAX（月内の最高値）。
 * 怪我で測定できなかった月は前回の値を引き継ぐ（測定値のない先頭の怪我は除外）
 */
export function monthlyMaxByMember(
  records: {
    memberId: number;
    date: Date;
    weightKg: number | null;
    injured: boolean;
  }[]
): Map<number, Map<number, number>> {
  const byMember = new Map<number, typeof records>();
  for (const r of records) {
    const list = byMember.get(r.memberId) ?? [];
    list.push(r);
    byMember.set(r.memberId, list);
  }

  const result = new Map<number, Map<number, number>>();
  for (const [memberId, list] of byMember) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    const byMonth = new Map<number, number>();
    let prev: number | null = null;
    for (const r of list) {
      const k = monthKey(r.date);
      if (r.weightKg != null) {
        prev = Math.max(r.weightKg, byMonth.get(k) ?? 0);
        byMonth.set(k, prev);
      } else if (r.injured && prev != null && !byMonth.has(k)) {
        byMonth.set(k, prev); // 怪我: 前回値を引き継ぎ
      }
    }
    if (byMonth.size > 0) result.set(memberId, byMonth);
  }
  return result;
}

/** 部員別の月次値を、recharts用の1本のデータ列（個人キー＋avg）にまとめる */
export function buildGroupChartData(
  byMember: Map<number, Map<number, number>>,
  members: MemberInfo[]
): { data: GroupDatum[]; seriesKeys: SeriesKey[] } {
  const included = members.filter((m) => byMember.has(m.id));
  const months = new Set<number>();
  for (const m of included) {
    for (const k of byMember.get(m.id)!.keys()) months.add(k);
  }

  const data = [...months]
    .sort((a, b) => a - b)
    .map((t) => {
      const row: GroupDatum = { t } as GroupDatum;
      let sum = 0;
      let n = 0;
      for (const m of included) {
        const v = byMember.get(m.id)!.get(t);
        if (v !== undefined) {
          row[`m${m.id}`] = v;
          sum += v;
          n += 1;
        }
      }
      if (n > 0) row.avg = Math.round((sum / n) * 10) / 10;
      return row;
    });

  return {
    data,
    seriesKeys: included.map((m) => ({ key: `m${m.id}`, name: m.name })),
  };
}
