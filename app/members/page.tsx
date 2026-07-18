import { prisma } from "@/lib/db";
import MemberForm from "@/components/MemberForm";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const members = await prisma.member.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { workoutLogs: true, maxRecords: true, bodyWeights: true } },
    },
  });

  return (
    <>
      <h1 className="page-title">部員管理</h1>
      <p className="page-desc">
        部員の登録と一覧。入力できる人（選手）と閲覧のみの人を分けて登録します。
      </p>

      <div className="grid-2">
        <div className="card">
          <h2>新しい部員を登録</h2>
          <MemberForm />
        </div>

        <div className="card">
          <h2>登録済み部員（{members.length}人）</h2>
          {members.length === 0 ? (
            <p className="empty">まだ部員がいません</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>ポジション</th>
                  <th>学年</th>
                  <th>権限</th>
                  <th>記録数</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>
                      {m.position ? (
                        <span className={`pos-tag ${m.position.toLowerCase()}`}>
                          {m.position}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{m.grade ? `${m.grade}年` : "—"}</td>
                    <td>
                      <span className={`role-tag ${m.role}`}>
                        {m.role === "input" ? "入力可" : "閲覧のみ"}
                      </span>
                    </td>
                    <td>
                      {m._count.workoutLogs + m._count.maxRecords + m._count.bodyWeights}
                      件
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
