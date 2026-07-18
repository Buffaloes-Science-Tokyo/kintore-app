// デモデータ投入スクリプト: node prisma/seed.mjs
// 実運用を始める前に確認用のサンプル部員と半年分の記録を作る
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// MAX対象3種目のベース値（kg）と成長係数
const INPUT_MEMBERS = [
  { name: "佐藤 健太", position: "Backs", grade: 2, base: { squat: 80, clean: 55, bench: 60, weight: 66 }, growth: 1.0 },
  { name: "鈴木 大輝", position: "Lines", grade: 4, base: { squat: 110, clean: 75, bench: 80, weight: 75 }, growth: 0.7 },
  { name: "高橋 翔", position: "Skills", grade: 1, base: { squat: 70, clean: 45, bench: 50, weight: 60 }, growth: 1.3 },
  { name: "田中 蓮", position: "Backs", grade: 3, base: { squat: 95, clean: 65, bench: 70, weight: 70 }, growth: 0.9 },
  { name: "伊藤 陽向", position: "Skills", grade: 1, base: { squat: 65, clean: 40, bench: 45, weight: 58 }, growth: 1.5 },
  { name: "渡辺 悠人", position: "Lines", grade: 4, base: { squat: 130, clean: 85, bench: 90, weight: 82 }, growth: 0.5 },
];

const VIEW_MEMBERS = ["山本 マネ", "監督"];

const EXERCISES = [
  { key: "squat", name: "スクワット", part: "脚" },
  { key: "clean", name: "パワークリーン", part: "脚" },
  { key: "bench", name: "ベンチプレス", part: "胸" },
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function round05(x) {
  return Math.round(x * 2) / 2;
}

async function main() {
  const memberCount = await prisma.member.count();
  if (memberCount > 0) {
    console.log("既にデータがあるためシードをスキップしました");
    return;
  }

  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - 6);

  for (const spec of INPUT_MEMBERS) {
    const member = await prisma.member.create({
      data: { name: spec.name, role: "input", position: spec.position, grade: spec.grade },
    });

    const weeks = 26;
    for (let w = 0; w < weeks; w++) {
      const weekStart = new Date(start.getTime() + w * 7 * 24 * 3600 * 1000);
      const progress = w / weeks; // 0→1

      // 体重: 半年で +2〜4kg（増量傾向）+ ゆらぎ
      const weightDay = new Date(weekStart.getTime() + 1 * 24 * 3600 * 1000);
      await prisma.bodyWeight.create({
        data: {
          memberId: member.id,
          date: weightDay,
          weightKg: round05(spec.base.weight + progress * spec.growth * 3 + rand(-0.6, 0.6)),
        },
      });

      // 週2〜3回のトレーニング。1回 = 1種目 × 3〜5セット（1行=1セット）
      const sessions = Math.random() < 0.5 ? 2 : 3;
      for (let s = 0; s < sessions; s++) {
        const day = new Date(
          weekStart.getTime() + Math.floor(rand(0, 6)) * 24 * 3600 * 1000
        );
        const ex = EXERCISES[Math.floor(rand(0, EXERCISES.length))];
        const workingMax = spec.base[ex.key] * (1 + progress * spec.growth * 0.15);
        const setCount = Math.floor(rand(3, 6));
        const baseWeight = round05(workingMax * rand(0.7, 0.85));
        for (let i = 0; i < setCount; i++) {
          await prisma.workoutLog.create({
            data: {
              memberId: member.id,
              date: day,
              exercise: ex.name,
              bodyPart: ex.part,
              setNumber: i + 1,
              // 後半のセットは少し重量を落とし、回数も減りがちにする
              weightKg: round05(baseWeight * (1 - i * 0.02)),
              reps: Math.max(3, Math.floor(rand(6, 11)) - i),
            },
          });
        }
      }
    }

    // MAX測定: 月1回 × 6ヶ月ぶん、種目ごとに右肩上がり
    for (let m = 0; m <= 6; m++) {
      const testDay = new Date(start);
      testDay.setMonth(testDay.getMonth() + m);
      for (const ex of EXERCISES) {
        const progress = m / 6;
        await prisma.maxRecord.create({
          data: {
            memberId: member.id,
            date: testDay,
            exercise: ex.name,
            weightKg: round05(
              spec.base[ex.key] * (1 + progress * spec.growth * 0.15) + rand(-1.5, 1.5)
            ),
          },
        });
      }
    }
  }

  for (const name of VIEW_MEMBERS) {
    await prisma.member.create({ data: { name, role: "view" } });
  }

  // 今月の目標（体重は現在値+α、MAXは現MAXより少し上）
  const month = new Date().toISOString().slice(0, 7);
  const allMembers = await prisma.member.findMany({ where: { role: "input" } });
  for (const m of allMembers) {
    const latest = await prisma.bodyWeight.findFirst({
      where: { memberId: m.id },
      orderBy: { date: "desc" },
    });
    if (!latest) continue;
    await prisma.goal.create({
      data: {
        memberId: m.id,
        month,
        targetWeightKg: round05(latest.weightKg + rand(0.5, 3)),
      },
    });
  }

  const logs = await prisma.workoutLog.count();
  const maxes = await prisma.maxRecord.count();
  const weights = await prisma.bodyWeight.count();
  console.log(
    `シード完了: 部員${INPUT_MEMBERS.length + VIEW_MEMBERS.length}人 / セット記録${logs}件 / MAX${maxes}件 / 体重${weights}件`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
