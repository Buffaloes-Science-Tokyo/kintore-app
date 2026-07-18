"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { BODY_PARTS, MAX_EXERCISES, POSITIONS } from "./exercises";

export type ActionResult = { ok: boolean; message: string };

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseNum(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function requireInputMember(formData: FormData): Promise<number | null> {
  const id = parseNum(formData.get("memberId"));
  if (!id) return null;
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member || member.role !== "input") return null;
  return member.id;
}

export async function addMember(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const role = formData.get("role") === "view" ? "view" : "input";
  const positionRaw = String(formData.get("position") ?? "");
  const position = POSITIONS.includes(positionRaw) ? positionRaw : null;
  const gradeRaw = Number(formData.get("grade"));
  const grade = [1, 2, 3, 4].includes(gradeRaw) ? gradeRaw : null;
  if (!name) return { ok: false, message: "名前を入力してください" };
  const exists = await prisma.member.findUnique({ where: { name } });
  if (exists) return { ok: false, message: "同じ名前の部員がすでに登録されています" };
  await prisma.member.create({ data: { name, role, position, grade } });
  revalidatePath("/", "layout");
  return { ok: true, message: `${name} を登録しました` };
}

/** 筋トレMEMO方式: 1種目ぶんのセットをまとめて記録する */
export async function addWorkoutSets(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const memberId = await requireInputMember(formData);
  if (!memberId) return { ok: false, message: "入力権限のある部員を選択してください" };

  const date = parseDate(formData.get("date"));
  const exercise = String(formData.get("exercise") ?? "").trim();
  const bodyPart = String(formData.get("bodyPart") ?? "");
  if (!date || !exercise) {
    return { ok: false, message: "日付と種目を入力してください" };
  }
  if (!BODY_PARTS.includes(bodyPart)) {
    return { ok: false, message: "部位を選択してください" };
  }

  let sets: { weightKg: number; reps: number }[];
  try {
    const raw = JSON.parse(String(formData.get("sets") ?? "[]"));
    if (!Array.isArray(raw)) throw new Error();
    sets = raw.map((s) => ({ weightKg: Number(s.weightKg), reps: Number(s.reps) }));
  } catch {
    return { ok: false, message: "セットの内容が不正です" };
  }

  sets = sets.filter(
    (s) =>
      Number.isFinite(s.weightKg) && s.weightKg > 0 &&
      Number.isFinite(s.reps) && s.reps > 0
  );
  if (sets.length === 0) {
    return { ok: false, message: "重量と回数を入力したセットが1つ以上必要です" };
  }

  await prisma.workoutLog.createMany({
    data: sets.map((s, i) => ({
      memberId,
      date,
      exercise,
      bodyPart,
      setNumber: i + 1,
      weightKg: s.weightKg,
      reps: Math.round(s.reps),
    })),
  });
  revalidatePath("/", "layout");

  const volume = Math.round(sets.reduce((a, s) => a + s.weightKg * s.reps, 0));
  return {
    ok: true,
    message: `${exercise} ${sets.length}セット（ボリューム ${volume}kg）を記録しました`,
  };
}

export async function addMaxRecord(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const memberId = await requireInputMember(formData);
  if (!memberId) return { ok: false, message: "入力権限のある部員を選択してください" };

  const date = parseDate(formData.get("date"));
  const exercise = String(formData.get("exercise") ?? "").trim();
  const injured = formData.get("injured") === "on";
  const weightKg = parseNum(formData.get("weightKg"));
  if (!date || !exercise || (!weightKg && !injured)) {
    return { ok: false, message: "日付・種目・重量を入力してください（怪我の場合は怪我にチェック）" };
  }
  if (!MAX_EXERCISES.includes(exercise)) {
    return {
      ok: false,
      message: `MAXの対象種目は ${MAX_EXERCISES.join("・")} のみです`,
    };
  }

  await prisma.maxRecord.create({
    data: { memberId, date, exercise, weightKg: injured ? null : weightKg, injured },
  });
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: injured
      ? `${exercise}: 怪我のため測定なしで記録しました🩹 お大事に`
      : `MAX更新: ${exercise} ${weightKg}kg を記録しました 💪`,
  };
}

/** 月末目標（体重・MAX3種目）の保存。同じ月なら上書き */
export async function upsertGoal(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const memberId = await requireInputMember(formData);
  if (!memberId) return { ok: false, message: "入力権限のある部員を選択してください" };

  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { ok: false, message: "対象月が不正です" };
  }

  const targetWeightKg = parseNum(formData.get("targetWeightKg"));
  const targetSquat = parseNum(formData.get("targetSquat"));
  const targetClean = parseNum(formData.get("targetClean"));
  const targetBench = parseNum(formData.get("targetBench"));
  if (!targetWeightKg && !targetSquat && !targetClean && !targetBench) {
    return { ok: false, message: "目標を1つ以上入力してください" };
  }

  const data = { targetWeightKg, targetSquat, targetClean, targetBench };
  await prisma.goal.upsert({
    where: { memberId_month: { memberId, month } },
    create: { memberId, month, ...data },
    update: data,
  });
  revalidatePath("/", "layout");
  const monthLabel = Number(month.slice(5, 7));
  return { ok: true, message: `${monthLabel}月末の目標を保存しました 🎯` };
}

export async function addBodyWeight(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const memberId = await requireInputMember(formData);
  if (!memberId) return { ok: false, message: "入力権限のある部員を選択してください" };

  const date = parseDate(formData.get("date"));
  const weightKg = parseNum(formData.get("weightKg"));
  if (!date || !weightKg) {
    return { ok: false, message: "日付と体重を入力してください" };
  }

  await prisma.bodyWeight.create({ data: { memberId, date, weightKg } });
  revalidatePath("/", "layout");
  return { ok: true, message: `体重 ${weightKg}kg を記録しました` };
}
