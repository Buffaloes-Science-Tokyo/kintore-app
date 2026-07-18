import { prisma } from "@/lib/db";
import LogForms from "@/components/LogForms";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const members = await prisma.member.findMany({
    where: { role: "input" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <h1 className="page-title">記録する</h1>
      <p className="page-desc">
        トレーニング・MAX・体重・目標をここから入力します。MAX・体重・目標は部員を切り替えて連続入力できます。
      </p>
      <LogForms members={members} />
    </>
  );
}
