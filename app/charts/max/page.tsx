import { Suspense } from "react";
import { prisma } from "@/lib/db";
import FilterBar, { type FilterField } from "@/components/FilterBar";
import MaxKpiChart, { type MaxKpiDatum } from "@/components/MaxKpiChart";
import GroupChart from "@/components/GroupChart";
import { MAX_EXERCISES, POSITIONS } from "@/lib/exercises";
import {
  correlateNearest,
  corrLabel,
  monthlySetCount,
  monthlyTonnage,
  periodStart,
  type PeriodKey,
  type Point,
} from "@/lib/analytics";
import { buildGroupChartData, monthlyMaxByMember } from "@/lib/groupSeries";

export const dynamic = "force-dynamic";

const MODE_OPTIONS = [
  { value: "", label: "個人 × KPI" },
  { value: "group", label: "グループ（平均＋個人）" },
];

const KPI_OPTIONS = [
  { value: "sets", label: "月間セット数" },
  { value: "ton", label: "月間トン数（重さ×回数）" },
  { value: "weight", label: "体重" },
  { value: "none", label: "なし（MAXのみ）" },
];

const SCOPE_OPTIONS = [
  { value: "ex", label: "この種目のみ" },
  { value: "all", label: "全種目" },
];

const PERIOD_OPTIONS = [
  { value: "3m", label: "直近3ヶ月" },
  { value: "6m", label: "直近6ヶ月" },
  { value: "1y", label: "直近1年" },
  { value: "all", label: "全期間" },
];

const GRADE_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "1", label: "1年" },
  { value: "2", label: "2年" },
  { value: "3", label: "3年" },
  { value: "4", label: "4年" },
];

type MaxPoint = Point & { injured?: boolean };

/** MAX記録を時系列点に変換。怪我の記録は前回の値を引き継ぎ、injuredフラグを付ける */
function toMaxPoints(
  records: { date: Date; weightKg: number | null; injured: boolean }[]
): MaxPoint[] {
  const points: MaxPoint[] = [];
  let prev: number | null = null;
  for (const r of records) {
    if (r.weightKg != null) {
      prev = r.weightKg;
      points.push({ t: r.date.getTime(), value: r.weightKg });
    } else if (r.injured && prev != null) {
      points.push({ t: r.date.getTime(), value: prev, injured: true });
    }
  }
  return points;
}

export default async function MaxChartPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;

  const mode = sp.mode === "group" ? "group" : "";
  // ポジション・学年で絞ると、部員の選択肢もその条件の人だけになる
  const pos = POSITIONS.includes(sp.pos ?? "") ? sp.pos! : "";
  const grade = ["1", "2", "3", "4"].includes(sp.grade ?? "") ? Number(sp.grade) : 0;
  const members = await prisma.member.findMany({
    where: {
      role: "input",
      ...(pos && { position: pos }),
      ...(grade && { grade }),
    },
    orderBy: { name: "asc" },
  });

  const memberId =
    members.find((m) => String(m.id) === sp.member)?.id ?? members[0]?.id;

  const exercise = MAX_EXERCISES.includes(sp.exercise ?? "")
    ? sp.exercise!
    : MAX_EXERCISES[0];
  const kpi = KPI_OPTIONS.some((o) => o.value === sp.kpi) ? sp.kpi! : "sets";
  const scope = sp.scope === "all" ? "all" : "ex";
  const period: PeriodKey = ["3m", "6m", "1y", "all"].includes(sp.period ?? "")
    ? (sp.period as PeriodKey)
    : "all";
  const since = periodStart(period);
  const dateFilter = since ? { gte: since } : undefined;

  const groupLabel =
    [pos, grade ? `${grade}年` : ""].filter(Boolean).join("・") || "全部員";

  const filterFields: FilterField[] = [
    { name: "mode", label: "表示モード", value: mode, options: MODE_OPTIONS },
    {
      name: "pos",
      label: "ポジション",
      value: pos,
      resets: ["member"],
      options: [
        { value: "", label: "すべて" },
        ...POSITIONS.map((p) => ({ value: p, label: p })),
      ],
    },
    {
      name: "grade",
      label: "学年",
      value: grade ? String(grade) : "",
      resets: ["member"],
      options: GRADE_OPTIONS,
    },
    ...(mode === "group"
      ? []
      : [
          {
            name: "member",
            label: "部員",
            value: String(memberId ?? ""),
            options:
              members.length > 0
                ? members.map((m) => ({ value: String(m.id), label: m.name }))
                : [{ value: "", label: "該当者なし" }],
          },
        ]),
    {
      name: "exercise",
      label: "MAX種目",
      value: exercise,
      options: MAX_EXERCISES.map((e) => ({ value: e, label: e })),
    },
    ...(mode === "group"
      ? []
      : [
          { name: "kpi", label: "比較するKPI", value: kpi, options: KPI_OPTIONS },
          {
            name: "scope",
            label: "KPIの集計対象",
            value: scope,
            options: SCOPE_OPTIONS,
          },
        ]),
    { name: "period", label: "期間", value: period, options: PERIOD_OPTIONS },
  ];

  // ---- グループ表示 ----
  if (mode === "group") {
    const records = await prisma.maxRecord.findMany({
      where: {
        memberId: { in: members.map((m) => m.id) },
        exercise,
        ...(dateFilter && { date: dateFilter }),
      },
      orderBy: { date: "asc" },
    });
    const { data, seriesKeys } = buildGroupChartData(
      monthlyMaxByMember(records),
      members
    );

    return (
      <>
        <h1 className="page-title">MAXの伸び × KPI</h1>
        <p className="page-desc">
          グループ表示: {exercise}のMAX推移をグループ平均（オレンジの太線）と各部員で重ねています。怪我の月は前回の値を引き継いでいます。
        </p>
        <Suspense>
          <FilterBar fields={filterFields} />
        </Suspense>
        <div className="card">
          <h2>
            {groupLabel} — {exercise} のMAX推移（{seriesKeys.length}人・平均＋個人）
          </h2>
          <GroupChart data={data} seriesKeys={seriesKeys} yLabel="MAX" unit="kg" />
        </div>
      </>
    );
  }

  // ---- 個人 × KPI 表示 ----
  let maxPoints: MaxPoint[] = [];
  let kpiPoints: Point[] = [];

  if (memberId) {
    const maxRecords = await prisma.maxRecord.findMany({
      where: { memberId, exercise, ...(dateFilter && { date: dateFilter }) },
      orderBy: { date: "asc" },
    });
    maxPoints = toMaxPoints(maxRecords);

    if (kpi === "none") {
      // KPIなし: MAXの推移だけを表示
    } else if (kpi === "weight") {
      const weights = await prisma.bodyWeight.findMany({
        where: { memberId, ...(dateFilter && { date: dateFilter }) },
        orderBy: { date: "asc" },
      });
      kpiPoints = weights.map((w) => ({ t: w.date.getTime(), value: w.weightKg }));
    } else {
      const logs = await prisma.workoutLog.findMany({
        where: {
          memberId,
          ...(scope === "ex" && { exercise }),
          ...(dateFilter && { date: dateFilter }),
        },
        select: { date: true, weightKg: true, reps: true },
      });
      kpiPoints = kpi === "sets" ? monthlySetCount(logs) : monthlyTonnage(logs);
    }
  }

  // MAXとKPIを1本の時系列にマージ
  const merged = new Map<number, MaxKpiDatum>();
  for (const p of maxPoints) {
    merged.set(p.t, {
      ...(merged.get(p.t) ?? { t: p.t }),
      max: p.value,
      ...(p.injured && { injured: true }),
    });
  }
  for (const p of kpiPoints) {
    merged.set(p.t, { ...(merged.get(p.t) ?? { t: p.t }), kpi: p.value });
  }
  const data = [...merged.values()].sort((a, b) => a.t - b.t);

  // 月単位KPIは月初の点になるため、対応づけの許容幅を広めにとる
  const { r, pairCount } = correlateNearest(
    maxPoints,
    kpiPoints,
    kpi === "weight" ? 21 : 45
  );
  const noKpi = kpi === "none";
  const kpiLabel = KPI_OPTIONS.find((o) => o.value === kpi)!.label;
  const kpiUnit = kpi === "weight" ? "kg" : kpi === "sets" ? "セット" : "t";
  const scopeLabel =
    kpi === "weight" || noKpi ? "" : scope === "ex" ? `・${exercise}のみ` : "・全種目";

  const memberName = members.find((m) => m.id === memberId)?.name ?? "—";
  const latestMax = maxPoints.at(-1);
  const firstMax = maxPoints[0];
  const gain =
    latestMax && firstMax && latestMax !== firstMax
      ? Math.round((latestMax.value - firstMax.value) * 10) / 10
      : null;

  return (
    <>
      <h1 className="page-title">MAXの伸び × KPI</h1>
      <p className="page-desc">
        MAX（スクワット・パワークリーン・ベンチプレス）の推移と、月間セット数・月間トン数・体重を重ねて相関を確認できます。
      </p>

      <Suspense>
        <FilterBar fields={filterFields} />
      </Suspense>

      <div className="stat-row">
        <div className="stat">
          <div className="label">現在のMAX（{exercise}）</div>
          <div className="value">
            {latestMax ? latestMax.value : "—"}
            <small> kg</small>
          </div>
        </div>
        <div className="stat">
          <div className="label">期間内の伸び</div>
          <div className="value">
            {gain !== null ? (gain >= 0 ? `+${gain}` : gain) : "—"}
            <small> kg</small>
          </div>
        </div>
        {!noKpi && (
          <div className="stat">
            <div className="label">相関係数（vs {kpiLabel}）</div>
            <div className="value">{r !== null ? r.toFixed(2) : "—"}</div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>
          {memberName} — {exercise} のMAX
          {!noKpi && ` × ${kpiLabel}`}
          {scopeLabel}
        </h2>
        <MaxKpiChart
          data={data}
          kpiName={noKpi ? "" : kpiLabel}
          kpiUnit={kpiUnit}
        />
        {!noKpi && (
          <p className="corr-note">
            相関: <span className="corr-value">{corrLabel(r)}</span>
            {r !== null && `（r = ${r.toFixed(2)}、対応づけできた記録 ${pairCount} 組）`}
            {" "}— MAX記録と、時期の近いKPI値を対応づけて計算しています。
          </p>
        )}
      </div>
    </>
  );
}
