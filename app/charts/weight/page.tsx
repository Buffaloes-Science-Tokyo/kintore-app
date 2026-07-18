import { Suspense } from "react";
import { prisma } from "@/lib/db";
import FilterBar, { type FilterField } from "@/components/FilterBar";
import WeightChart from "@/components/WeightChart";
import GroupChart from "@/components/GroupChart";
import { periodStart, type PeriodKey } from "@/lib/analytics";
import { POSITIONS } from "@/lib/exercises";
import { buildGroupChartData, monthlyWeightByMember } from "@/lib/groupSeries";

export const dynamic = "force-dynamic";

const MODE_OPTIONS = [
  { value: "", label: "個人" },
  { value: "group", label: "グループ（平均＋個人）" },
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

export default async function WeightChartPage({
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

  const period: PeriodKey = ["3m", "6m", "1y", "all"].includes(sp.period ?? "")
    ? (sp.period as PeriodKey)
    : "all";
  const since = periodStart(period);

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
    { name: "period", label: "期間", value: period, options: PERIOD_OPTIONS },
  ];

  // ---- グループ表示 ----
  if (mode === "group") {
    const weights = await prisma.bodyWeight.findMany({
      where: {
        memberId: { in: members.map((m) => m.id) },
        ...(since && { date: { gte: since } }),
      },
      orderBy: { date: "asc" },
    });
    const { data, seriesKeys } = buildGroupChartData(
      monthlyWeightByMember(weights),
      members
    );

    return (
      <>
        <h1 className="page-title">体重の推移</h1>
        <p className="page-desc">
          グループ表示: 月ごとの平均体重（オレンジの太線）と各部員の推移を重ねています。
        </p>
        <Suspense>
          <FilterBar fields={filterFields} />
        </Suspense>
        <div className="card">
          <h2>
            {groupLabel} の体重推移（{seriesKeys.length}人・平均＋個人）
          </h2>
          <GroupChart data={data} seriesKeys={seriesKeys} yLabel="体重" unit="kg" />
        </div>
      </>
    );
  }

  // ---- 個人表示 ----
  const weights = memberId
    ? await prisma.bodyWeight.findMany({
        where: { memberId, ...(since && { date: { gte: since } }) },
        orderBy: { date: "asc" },
      })
    : [];

  const data = weights.map((w) => ({ t: w.date.getTime(), weight: w.weightKg }));
  const latest = data.at(-1);
  const first = data[0];
  const change =
    latest && first && latest !== first
      ? Math.round((latest.weight - first.weight) * 10) / 10
      : null;

  const memberName = members.find((m) => m.id === memberId)?.name ?? "—";

  return (
    <>
      <h1 className="page-title">体重の推移</h1>
      <p className="page-desc">
        部員ごとの体重推移。ポジション・学年・期間で絞り込みでき、グループ表示にすると平均と個人を重ねて見られます。
      </p>

      <Suspense>
        <FilterBar fields={filterFields} />
      </Suspense>

      <div className="stat-row">
        <div className="stat">
          <div className="label">最新の体重</div>
          <div className="value">
            {latest ? latest.weight : "—"}
            <small> kg</small>
          </div>
        </div>
        <div className="stat">
          <div className="label">期間内の増減</div>
          <div className="value">
            {change !== null ? (change >= 0 ? `+${change}` : change) : "—"}
            <small> kg</small>
          </div>
        </div>
        <div className="stat">
          <div className="label">記録回数</div>
          <div className="value">
            {data.length}
            <small> 回</small>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>{memberName} の体重推移</h2>
        <WeightChart data={data} />
      </div>
    </>
  );
}
