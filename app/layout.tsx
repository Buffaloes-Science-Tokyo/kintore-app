import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "BUFFALOES 筋トレ管理",
  description: "Titech Buffaloes 部員の筋トレ記録・MAX・体重をまとめて管理",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const members = await prisma.member.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });

  return (
    <html lang="ja">
      <body>
        <header className="site-header">
          <div className="inner">
            <div className="brand">
              🦬 BUFFALOES
              <span className="sub">筋トレ管理</span>
            </div>
            <NavBar members={members} />
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
