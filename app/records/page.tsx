import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import FilterBar from "@/components/FilterBar";
import MemberSync from "@/components/MemberSync";
import { BODY_PARTS, MAX_EXERCISES, POSITIONS } from "@/lib/exercises";
import { formatSets, groupSessions } from "@/lib/sessions";
import { lastWeeks, mondayOf, weekLabel } from "@/lib/weekly";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "training", label: "🏋️ トレーニング" },
  { key: "max", label: "💪 MAX" },
  { key: "weight", label: "⚖️ 体重" },
] as const;

function buildQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.key === sp.view) ? sp.view! : "training";

  const members = await prisma.member.findMany({ orderBy: { name: "asc" } });
  const me = members.find((m) => String(m.id) === sp.member);

  return (
    <>
      <Suspense>
        <MemberSync />
      </Suspense>

      <h1 className="page-title">記録一覧</h1>
      <p className="page-desc">
        {me
          ? `${me.name} さんの記録を表示しています（ホームで名前を切り替えられます）`
          : "ホームで名前を選ぶと、自分の記録が表示されます"}
      </p>

      <div className="tabs">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            className={view === v.key ? "active" : ""}
            href={`/records${buildQuery({ view: v.key, member: sp.member })}`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {view === "training" && <TrainingView me={me} sp={sp} />}
      {view === "max" && <MaxView me={me} sp={sp} />}
      {view === "weight" && <WeightView me={me} />}
    </>
  );
}

type Me = { id: number; name: string } | undefined;
type SP = { [key: string]: string | undefined };

/** 直近4週の部位別セット数（本人） */
async function WeeklyPartTable({ memberId }: { memberId: number }) {
  const weeks = lastWeeks(4);
  const logs = await prisma.workoutLog.findMany({
    where: { memberId, date: { gte: new Date(weeks[0]) } },
    select: { date: true, bodyPart: true },
  });

  // 週 × 部位のセット数
  const counts = new Map<number, Map<string, number>>();
  for (const log of logs) {
    const w = mondayOf(log.date);
    if (!counts.has(w)) counts.set(w, new Map());
    const part = log.bodyPart ?? "その他";
    const m = counts.get(w)!;
    m.set(part, (m.get(part) ?? 0) + 1);
  }

  return (
    <div className="card">
      <h2>🗓 部位別セット数（直近4週）</h2>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>週</th>
              {BODY_PARTS.map((p) => (
                <th key={p}>{p}</th>
              ))}
              <th>合計</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => {
              const m = counts.get(w);
              const total = m ? [...m.values()].reduce((a, b) => a + b, 0) : 0;
              const isThisWeek = i === weeks.length - 1;
              return (
                <tr key={w} className={isThisWeek ? "this-week" : ""}>
                  <td>
                    {weekLabel(w)}
                    {isThisWeek && "（今週）"}
                  </td>
                  {BODY_PARTS.map((p) => (
                    <td key={p}>{m?.get(p) ?? "—"}</td>
                  ))}
                  <td>
                    <b>{total || "—"}</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 本人のトレーニング記録（全員分は /records/all に分離） */
async function TrainingView({ me, sp }: { me: Me; sp: SP }) {
  if (!me) return <NoMember />;

  const exerciseRows = await prisma.workoutLog.findMany({
    where: { memberId: me.id },
    select: { exercise: true },
    distinct: ["exercise"],
    orderBy: { exercise: "asc" },
  });
  const exercises = exerciseRows.map((r) => r.exercise);
  const exercise = exercises.includes(sp.exercise ?? "") ? sp.exercise : undefined;

  const logs = await prisma.workoutLog.findMany({
    where: { memberId: me.id, ...(exercise && { exercise }) },
    orderBy: [{ date: "desc" }, { setNumber: "asc" }],
    take: 300,
    include: { member: true },
  });
  const sessions = groupSessions(logs).slice(0, 30);

  return (
    <>
      <WeeklyPartTable memberId={me.id} />
      <div className="card">
        <h2>{me.name} のトレーニング記録</h2>
      {exercises.length > 0 && (
        <Suspense>
          <FilterBar
            fields={[
              {
                name: "exercise",
                label: "種目",
                value: exercise ?? "",
                options: [
                  { value: "", label: "すべての種目" },
                  ...exercises.map((e) => ({ value: e, label: e })),
                ],
              },
            ]}
          />
        </Suspense>
      )}
      {sessions.length === 0 ? (
        <p className="empty">まだ記録がありません</p>
      ) : (
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>日付</th>
                <th>部位</th>
                <th>種目</th>
                <th>セット内容（kg×回）</th>
                <th>ボリューム</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.key}>
                  <td>{s.date.toISOString().slice(0, 10)}</td>
                  <td>{s.bodyPart ?? "—"}</td>
                  <td>{s.exercise}</td>
                  <td>{formatSets(s.sets)}</td>
                  <td>{Math.round(s.volume).toLocaleString()}kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        <p className="corr-note">
          部員全員の記録は <Link href="/records/all">みんなの記録 →</Link> で見られます
        </p>
      </div>
    </>
  );
}

/** MAX: 部内ランキング + 本人のMAX履歴 */
async function MaxView({ me, sp }: { me: Me; sp: SP }) {
  const rankEx = MAX_EXERCISES.includes(sp.rankEx ?? "")
    ? sp.rankEx!
    : MAX_EXERCISES[0];
  const rankPos = POSITIONS.includes(sp.rankPos ?? "") ? sp.rankPos! : "";
  const rankGrade = ["1", "2", "3", "4"].includes(sp.rankGrade ?? "")
    ? Number(sp.rankGrade)
    : 0;

  const [maxForRanking, myMaxes] = await Promise.all([
    prisma.maxRecord.findMany({
      where: {
        exercise: rankEx,
        member: {
          ...(rankPos && { position: rankPos }),
          ...(rankGrade && { grade: rankGrade }),
        },
      },
      include: { member: true },
      orderBy: { date: "desc" },
    }),
    me
      ? prisma.maxRecord.findMany({
          where: { memberId: me.id },
          orderBy: { date: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  const bestByMember = new Map<
    number,
    { name: string; position: string | null; weightKg: number; date: Date }
  >();
  for (const r of maxForRanking) {
    if (r.weightKg == null) continue; // 怪我で未測定の記録はランキング対象外
    const cur = bestByMember.get(r.memberId);
    if (!cur || r.weightKg > cur.weightKg) {
      bestByMember.set(r.memberId, {
        name: r.member.name,
        position: r.member.position,
        weightKg: r.weightKg,
        date: r.date,
      });
    }
  }
  const ranking = [...bestByMember.values()].sort((a, b) => b.weightKg - a.weightKg);

  return (
    <>
      <div className="card">
        <h2>🏆 MAXランキング</h2>
        <Suspense>
          <FilterBar
            fields={[
              {
                name: "rankEx",
                label: "種目",
                value: rankEx,
                options: MAX_EXERCISES.map((e) => ({ value: e, label: e })),
              },
              {
                name: "rankPos",
                label: "ポジション",
                value: rankPos,
                options: [
                  { value: "", label: "すべて" },
                  ...POSITIONS.map((p) => ({ value: p, label: p })),
                ],
              },
              {
                name: "rankGrade",
                label: "学年",
                value: rankGrade ? String(rankGrade) : "",
                options: [
                  { value: "", label: "すべて" },
                  { value: "1", label: "1年" },
                  { value: "2", label: "2年" },
                  { value: "3", label: "3年" },
                  { value: "4", label: "4年" },
                ],
              },
            ]}
          />
        </Suspense>
        {ranking.length === 0 ? (
          <p className="empty">MAX記録がまだありません</p>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>順位</th>
                  <th>名前</th>
                  <th>ポジション</th>
                  <th>MAX</th>
                  <th>記録日</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.name}>
                    <td className={i === 0 ? "rank-1" : ""}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}位`}
                    </td>
                    <td className={i === 0 ? "rank-1" : ""}>{r.name}</td>
                    <td>
                      {r.position ? (
                        <span className={`pos-tag ${r.position.toLowerCase()}`}>
                          {r.position}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={i === 0 ? "rank-1" : ""}>{r.weightKg}kg</td>
                    <td>{r.date.toISOString().slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {me && (
        <div className="card">
          <h2>{me.name} のMAX履歴</h2>
          {myMaxes.length === 0 ? (
            <p className="empty">まだMAX記録がありません</p>
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>種目</th>
                    <th>MAX</th>
                  </tr>
                </thead>
                <tbody>
                  {myMaxes.map((m) => (
                    <tr key={m.id}>
                      <td>{m.date.toISOString().slice(0, 10)}</td>
                      <td>{m.exercise}</td>
                      <td>{m.weightKg != null ? `${m.weightKg}kg` : "🩹 怪我（測定なし）"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** 本人の体重履歴 */
async function WeightView({ me }: { me: Me }) {
  if (!me) return <NoMember />;

  const weights = await prisma.bodyWeight.findMany({
    where: { memberId: me.id },
    orderBy: { date: "desc" },
    take: 30,
  });

  return (
    <div className="card">
      <h2>{me.name} の体重記録</h2>
      {weights.length === 0 ? (
        <p className="empty">まだ体重記録がありません</p>
      ) : (
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>日付</th>
                <th>体重</th>
                <th>前回比</th>
              </tr>
            </thead>
            <tbody>
              {weights.map((w, i) => {
                const prev = weights[i + 1];
                const diff = prev
                  ? Math.round((w.weightKg - prev.weightKg) * 10) / 10
                  : null;
                return (
                  <tr key={w.id}>
                    <td>{w.date.toISOString().slice(0, 10)}</td>
                    <td>{w.weightKg}kg</td>
                    <td>
                      {diff === null ? "—" : diff > 0 ? `+${diff}kg` : `${diff}kg`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="corr-note">
        推移のグラフは <Link href="/charts/weight">体重グラフ →</Link> で見られます
      </p>
    </div>
  );
}

function NoMember() {
  return (
    <div className="card">
      <p className="empty">
        <Link href="/">ホーム</Link>で自分の名前を選ぶと、ここに記録が表示されます
      </p>
    </div>
  );
}
