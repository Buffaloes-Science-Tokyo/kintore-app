import Link from "next/link";
import { prisma } from "@/lib/db";
import NamePicker from "@/components/NamePicker";
import { POSITIONS } from "@/lib/exercises";

export const dynamic = "force-dynamic";

type GoalRow = {
  name: string;
  position: string | null;
  target: number;
  current: number;
  diff: number; // 目標 − 現在（＋なら増量が残っている）
  absDiff: number;
};

function fmtDiff(diff: number) {
  if (diff === 0) return "達成！";
  return diff > 0 ? `あと +${diff}kg` : `あと ${diff}kg`;
}

/** チーム報告用の月次CSVダウンロード（月はデフォルト今月、過去の月も選べる） */
function MonthlyReportCard({ month }: { month: string }) {
  return (
    <div className="card">
      <h2>📄 月次レポート（CSV）</h2>
      <p className="page-desc" style={{ marginBottom: 12 }}>
        月を選んでダウンロードできます（Excelで開けます）。
        <br />
        ・月次レポート: 部員全員の目標と実績（体重・MAX3種目・達成○×）
        <br />
        ・月次体重レポート: 名前・ポジション・目標体重と、その月の日付ごとの体重記録
      </p>
      <form method="get" action="/api/report" className="dl-row">
        <input
          type="month"
          name="month"
          defaultValue={month}
          max={month}
          required
          className="month-input"
          aria-label="レポートの月"
        />
        <button type="submit" className="dl-btn">
          ⬇ 月次レポート
        </button>
        <button type="submit" className="dl-btn secondary" formAction="/api/weight-report">
          ⬇ 月次体重レポート
        </button>
      </form>
    </div>
  );
}

export default async function DashboardPage() {
  const month = new Date().toISOString().slice(0, 7);
  const monthLabel = Number(month.slice(5, 7));

  const [members, goals, logCount, maxCount, weightCount] = await Promise.all([
    prisma.member.findMany({ orderBy: { name: "asc" } }),
    prisma.goal.findMany({
      where: { month, targetWeightKg: { not: null }, member: { role: "input" } },
      include: { member: true },
    }),
    prisma.workoutLog.count(),
    prisma.maxRecord.count(),
    prisma.bodyWeight.count(),
  ]);

  // 各部員の最新体重（1クエリで取得して先頭だけ使う）
  const weights = await prisma.bodyWeight.findMany({
    where: { memberId: { in: goals.map((g) => g.memberId) } },
    orderBy: { date: "desc" },
  });
  const latestByMember = new Map<number, number>();
  for (const w of weights) {
    if (!latestByMember.has(w.memberId)) latestByMember.set(w.memberId, w.weightKg);
  }

  const rows: GoalRow[] = goals
    .flatMap((g) => {
      const current = latestByMember.get(g.memberId);
      if (current === undefined) return [];
      const diff = Math.round((g.targetWeightKg! - current) * 10) / 10;
      return [
        {
          name: g.member.name,
          position: g.member.position,
          target: g.targetWeightKg!,
          current,
          diff,
          absDiff: Math.abs(diff),
        },
      ];
    })
    .sort((a, b) => a.absDiff - b.absDiff);

  const top5 = rows.slice(0, 5);
  const bottom5 =
    rows.length > 5 ? rows.slice(Math.max(5, rows.length - 5)).reverse() : [];

  // ポジションごとの「目標との差」の平均
  const posAvgs = POSITIONS.flatMap((p) => {
    const list = rows.filter((r) => r.position === p);
    if (list.length === 0) return [];
    const avg =
      Math.round((list.reduce((a, r) => a + r.absDiff, 0) / list.length) * 10) / 10;
    return [{ position: p, avg, count: list.length }];
  });
  const maxAvg = Math.max(...posAvgs.map((p) => p.avg), 0.1);

  const inputMemberCount = members.filter((m) => m.role === "input").length;
  const noGoalCount = inputMemberCount - rows.length;

  return (
    <>
      <h1 className="page-title">🎯 {monthLabel}月末の目標体重まで</h1>
      <p className="page-desc">
        {monthLabel}月末の目標体重と現在の体重の差。目標は「記録する（ホーム）→
        🎯目標」タブから設定できます。
        {noGoalCount > 0 && `（目標未設定: ${noGoalCount}人）`}
      </p>

      {rows.length === 0 ? (
        <div className="card">
          <p className="empty">
            今月の目標がまだ設定されていません。
            <Link href="/">「記録する」の🎯目標タブ</Link>から設定しましょう。
          </p>
        </div>
      ) : (
        <>
          <div className="grid-2">
            <div className="card">
              <h2>🏅 目標まであと少し TOP5</h2>
              <table className="data">
                <thead>
                  <tr>
                    <th>順位</th>
                    <th>名前</th>
                    <th>現在→目標</th>
                    <th>差</th>
                  </tr>
                </thead>
                <tbody>
                  {top5.map((r, i) => (
                    <tr key={r.name}>
                      <td className={i === 0 ? "rank-1" : ""}>{i + 1}位</td>
                      <td className={i === 0 ? "rank-1" : ""}>{r.name}</td>
                      <td>
                        {r.current} → {r.target}kg
                      </td>
                      <td className="diff-close">{fmtDiff(r.diff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2>🔥 気合を入れたい5人</h2>
              {bottom5.length === 0 ? (
                <p className="empty">部員が5人以下のため全員TOP5に表示中</p>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>名前</th>
                      <th>現在→目標</th>
                      <th>差</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bottom5.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td>
                          {r.current} → {r.target}kg
                        </td>
                        <td className="diff-far">{fmtDiff(r.diff)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {posAvgs.length > 0 && (
            <div className="card">
              <h2>📊 ポジション別 目標との差（平均）</h2>
              <div className="goal-bars">
                {posAvgs.map((p) => (
                  <div className="bar-row" key={p.position}>
                    <span className={`pos-tag ${p.position.toLowerCase()}`}>
                      {p.position}
                    </span>
                    <div className="bar-track">
                      <div
                        className={`bar-fill ${p.position.toLowerCase()}`}
                        style={{ width: `${(p.avg / maxAvg) * 100}%` }}
                      />
                    </div>
                    <span className="bar-value">
                      平均 {p.avg}kg <small>({p.count}人)</small>
                    </span>
                  </div>
                ))}
              </div>
              <p className="corr-note">差が小さいポジションほど目標達成に近い</p>
            </div>
          )}
        </>
      )}

      <MonthlyReportCard month={month} />

      <div className="card">
        <h2>あなたは誰？（👀 = 閲覧のみ）</h2>
        <NamePicker
          members={members.map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role,
          }))}
        />
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="label">部員数</div>
          <div className="value">
            {members.length}
            <small> 人</small>
          </div>
        </div>
        <div className="stat">
          <div className="label">トレーニング記録</div>
          <div className="value">
            {logCount}
            <small> 件</small>
          </div>
        </div>
        <div className="stat">
          <div className="label">MAX記録</div>
          <div className="value">
            {maxCount}
            <small> 件</small>
          </div>
        </div>
        <div className="stat">
          <div className="label">体重記録</div>
          <div className="value">
            {weightCount}
            <small> 件</small>
          </div>
        </div>
      </div>

    </>
  );
}
