"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import TodayMenu from "@/components/TodayMenu";
import {
  addWorkoutSets,
  updateWorkoutSession,
  deleteWorkoutSession,
  addMaxRecord,
  addBodyWeight,
  upsertGoal,
  type ActionResult,
} from "@/lib/actions";
import { BODY_PARTS, COMMON_EXERCISES, MAX_EXERCISES } from "@/lib/exercises";
import { useCurrentMember } from "@/lib/currentMember";

export type MemberOption = { id: number; name: string };

function today() {
  return new Date().toISOString().slice(0, 10);
}

type SetInput = { weightKg: string; reps: string };

function Message({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p className={`form-message ${result.ok ? "ok" : "ng"}`}>{result.message}</p>
  );
}

/** 保存成功時に「今日の実施メニュー」へ更新を通知する */
function useNotifyLogged(result: ActionResult | null) {
  useEffect(() => {
    if (result?.ok) window.dispatchEvent(new Event("kintore-logged"));
  }, [result]);
}

/** MAX・体重・目標で使う「誰の記録か」の選択。トレーナーの連続一括入力用 */
function MemberSelect({
  members,
  value,
  onChange,
}: {
  members: MemberOption[];
  value: number;
  onChange: (id: number) => void;
}) {
  return (
    <label className="field">
      <span>部員</span>
      <select
        name="memberId"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 編集時に渡す既存セッションの内容 */
export type WorkoutSessionData = {
  date: string; // YYYY-MM-DD
  exercise: string;
  bodyPart: string;
  sets: { weightKg: number; reps: number }[];
};

/**
 * 筋トレMEMO風: 種目を選び、セットを1行ずつ追加していく（本人の記録専用）。
 * initial を渡すと過去の記録の編集モードになる
 */
export function WorkoutForm({
  memberId,
  memberName,
  initial,
  returnTo,
}: {
  memberId: number;
  memberName: string;
  initial?: WorkoutSessionData;
  /** 編集後の戻り先（"log" なら「記録する」へ戻る） */
  returnTo?: "log";
}) {
  const isEdit = !!initial;
  const [result, action, pending] = useActionState(
    isEdit ? updateWorkoutSession : addWorkoutSets,
    null
  );
  const [deleteResult, deleteAction, deleting] = useActionState(deleteWorkoutSession, null);
  useNotifyLogged(result);
  const [date, setDate] = useState(initial?.date ?? today());
  const [bodyPart, setBodyPart] = useState(initial?.bodyPart ?? "");
  const [exercise, setExercise] = useState(initial?.exercise ?? "");
  const [sets, setSets] = useState<SetInput[]>(
    initial?.sets.map((s) => ({ weightKg: String(s.weightKg), reps: String(s.reps) })) ?? [
      { weightKg: "", reps: "" },
    ]
  );

  function updateSet(index: number, field: keyof SetInput, value: string) {
    setSets((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function addSet() {
    // 直前のセットの値を引き継ぐ（同重量で続けることが多いため）
    const last = sets.at(-1);
    setSets((prev) => [...prev, { weightKg: last?.weightKg ?? "", reps: last?.reps ?? "" }]);
  }

  function removeSet(index: number) {
    setSets((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const validSets = sets.filter((s) => Number(s.weightKg) >= 0 && Number(s.reps) > 0);
  const volume = Math.round(
    validSets.reduce((a, s) => a + Number(s.weightKg) * Number(s.reps), 0)
  );

  return (
    <div className="card">
      <h2>
        {memberName} のトレーニングを{isEdit ? "編集" : "記録"}
      </h2>
      <datalist id="exercise-list">
        {COMMON_EXERCISES.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
      <form
        action={(formData) => {
          formData.set(
            "sets",
            JSON.stringify(
              validSets.map((s) => ({ weightKg: Number(s.weightKg), reps: Number(s.reps) }))
            )
          );
          action(formData);
          if (!isEdit) {
            setSets([{ weightKg: "", reps: "" }]);
            setExercise("");
          }
        }}
      >
        <input type="hidden" name="memberId" value={memberId} />
        {initial && (
          <>
            <input type="hidden" name="origDate" value={initial.date} />
            <input type="hidden" name="origExercise" value={initial.exercise} />
            {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          </>
        )}
        <input type="hidden" name="sets" value="[]" />
        <div className="field-row">
          <label className="field">
            <span>日付</span>
            <input
              type="date"
              name="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>部位</span>
            <select
              name="bodyPart"
              value={bodyPart}
              onChange={(e) => setBodyPart(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              {BODY_PARTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>種目（自由入力OK）</span>
          <input
            name="exercise"
            list="exercise-list"
            placeholder="例: ベンチプレス"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            required
          />
        </label>

        <div className="set-list">
          {sets.map((s, i) => (
            <div className="set-row" key={i}>
              <span className="set-no">{i + 1}セット目</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder="60"
                value={s.weightKg}
                onChange={(e) => updateSet(i, "weightKg", e.target.value)}
                aria-label={`${i + 1}セット目の重量`}
              />
              <span className="set-unit">kg ×</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="10"
                value={s.reps}
                onChange={(e) => updateSet(i, "reps", e.target.value)}
                aria-label={`${i + 1}セット目の回数`}
              />
              <span className="set-unit">回</span>
              <button
                type="button"
                className="set-remove"
                onClick={() => removeSet(i)}
                disabled={sets.length <= 1}
                aria-label={`${i + 1}セット目を削除`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="set-add" onClick={addSet}>
          ＋ セットを追加
        </button>

        <div className="totals">
          <span>
            セット数 <b>{validSets.length}</b>
          </span>
          <span>
            総ボリューム <b>{volume.toLocaleString()}</b> kg
          </span>
        </div>

        <button className="primary" disabled={pending || deleting || validSets.length === 0}>
          {isEdit
            ? pending ? "保存中…" : "変更を保存する"
            : pending ? "記録中…" : "この種目を記録する"}
        </button>
        <Message result={result} />
      </form>

      {initial && (
        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!confirm(`${initial.date} の ${initial.exercise} の記録を削除しますか？`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="origDate" value={initial.date} />
          <input type="hidden" name="origExercise" value={initial.exercise} />
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <button className="danger" disabled={pending || deleting}>
            {deleting ? "削除中…" : "この記録を削除する"}
          </button>
          <Message result={deleteResult} />
        </form>
      )}
    </div>
  );
}

function MaxForm({ members, initialId }: { members: MemberOption[]; initialId: number }) {
  const [result, action, pending] = useActionState(addMaxRecord, null);
  useNotifyLogged(result);
  const [memberId, setMemberId] = useState(initialId);
  const [injured, setInjured] = useState(false);
  const memberName = members.find((m) => m.id === memberId)?.name ?? "—";

  return (
    <div className="card">
      <h2>{memberName} のMAXを記録</h2>
      <form action={action}>
        <MemberSelect members={members} value={memberId} onChange={setMemberId} />
        <label className="field">
          <span>日付</span>
          <input type="date" name="date" defaultValue={today()} required />
        </label>
        <label className="field">
          <span>種目（MAX測定はこの3種目）</span>
          <select name="exercise" defaultValue={MAX_EXERCISES[0]}>
            {MAX_EXERCISES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="injured-check">
          <input
            type="checkbox"
            name="injured"
            checked={injured}
            onChange={(e) => setInjured(e.target.checked)}
          />
          🩹 怪我のため測定できず
        </label>
        {!injured && (
          <label className="field">
            <span>MAX重量 (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              name="weightKg"
              step="0.1"
              min="1"
              placeholder="100"
              required
            />
          </label>
        )}
        <button className="primary" disabled={pending}>
          {pending ? "記録中…" : injured ? "怪我として記録する" : "MAXを記録する"}
        </button>
        <Message result={result} />
      </form>
      <p className="corr-note">
        部員を切り替えるだけで連続入力できます。怪我の月はグラフに🩹ラベルが付き、値は前回のMAXを引き継ぎます
      </p>
    </div>
  );
}

function WeightForm({ members, initialId }: { members: MemberOption[]; initialId: number }) {
  const [result, action, pending] = useActionState(addBodyWeight, null);
  useNotifyLogged(result);
  const [memberId, setMemberId] = useState(initialId);
  const memberName = members.find((m) => m.id === memberId)?.name ?? "—";

  return (
    <div className="card">
      <h2>{memberName} の体重を記録</h2>
      <form action={action}>
        <MemberSelect members={members} value={memberId} onChange={setMemberId} />
        <label className="field">
          <span>日付</span>
          <input type="date" name="date" defaultValue={today()} required />
        </label>
        <label className="field">
          <span>体重 (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            name="weightKg"
            step="0.1"
            min="20"
            placeholder="65.5"
            required
          />
        </label>
        <button className="primary" disabled={pending}>
          {pending ? "記録中…" : "体重を記録する"}
        </button>
        <Message result={result} />
      </form>
      <p className="corr-note">
        部員を切り替えるだけで連続入力できます（日付はそのまま残ります）
      </p>
    </div>
  );
}

/** 月末目標の入力。部員を切り替えるとその人の設定済み目標をプリフィル */
function GoalForm({ members, initialId }: { members: MemberOption[]; initialId: number }) {
  const [result, action, pending] = useActionState(upsertGoal, null);
  const [memberId, setMemberId] = useState(initialId);
  const month = new Date().toISOString().slice(0, 7);
  const monthLabel = Number(month.slice(5, 7));
  const memberName = members.find((m) => m.id === memberId)?.name ?? "—";

  type GoalData = {
    targetWeightKg: number | null;
    targetSquat: number | null;
    targetClean: number | null;
    targetBench: number | null;
  };
  const [goal, setGoal] = useState<GoalData | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    setGoal("loading");
    fetch(`/api/goal?member=${memberId}&month=${month}`)
      .then((r) => (r.ok ? r.json() : { goal: null }))
      .then((d) => {
        if (!cancelled) setGoal(d.goal ?? null);
      })
      .catch(() => {
        if (!cancelled) setGoal(null);
      });
    return () => {
      cancelled = true;
    };
  }, [memberId, month]);

  return (
    <div className="card">
      <h2>
        {memberName} の{monthLabel}月末の目標
      </h2>
      <MemberSelect members={members} value={memberId} onChange={setMemberId} />
      {goal === "loading" ? (
        <p className="empty">読み込み中…</p>
      ) : (
        <form action={action} key={`${memberId}-${JSON.stringify(goal)}`}>
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="month" value={month} />
          <label className="field">
            <span>目標体重 (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              name="targetWeightKg"
              step="0.1"
              min="20"
              placeholder="70.0"
              defaultValue={goal?.targetWeightKg ?? ""}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>スクワット (kg)</span>
              <input
                type="number"
                inputMode="decimal"
                name="targetSquat"
                step="0.1"
                min="1"
                placeholder="100"
                defaultValue={goal?.targetSquat ?? ""}
              />
            </label>
            <label className="field">
              <span>パワークリーン (kg)</span>
              <input
                type="number"
                inputMode="decimal"
                name="targetClean"
                step="0.1"
                min="1"
                placeholder="70"
                defaultValue={goal?.targetClean ?? ""}
              />
            </label>
            <label className="field">
              <span>ベンチプレス (kg)</span>
              <input
                type="number"
                inputMode="decimal"
                name="targetBench"
                step="0.1"
                min="1"
                placeholder="80"
                defaultValue={goal?.targetBench ?? ""}
              />
            </label>
          </div>
          <button className="primary" disabled={pending}>
            {pending ? "保存中…" : "目標を保存する"}
          </button>
          <Message result={result} />
        </form>
      )}
      <p className="corr-note">
        目標体重との差はダッシュボードのランキングに反映されます
      </p>
    </div>
  );
}

export default function LogForms({ members }: { members: MemberOption[] }) {
  const member = useCurrentMember();
  const isPlayer = member?.role === "input";
  const [tab, setTab] = useState<"workout" | "max" | "weight" | "goal">("workout");

  // 閲覧メンバー（トレーナー・監督）は一括入力から始めることが多いのでMAXタブを初期表示
  useEffect(() => {
    if (member && !isPlayer && tab === "workout") setTab("max");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id]);

  if (!member) {
    return (
      <div className="card">
        <p className="empty">
          先に<Link href="/dashboard">ダッシュボード</Link>かヘッダー右上で自分の名前を選んでください。
        </p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="card">
        <p className="empty">
          入力できる部員がいません。<Link href="/members">部員管理</Link>から登録してください。
        </p>
      </div>
    );
  }

  const initialId = isPlayer ? member.id : members[0].id;

  return (
    <>
      <div className="tabs">
        <button
          className={tab === "workout" ? "active" : ""}
          onClick={() => setTab("workout")}
        >
          🏋️ トレーニング
        </button>
        <button className={tab === "max" ? "active" : ""} onClick={() => setTab("max")}>
          💪 MAX
        </button>
        <button
          className={tab === "weight" ? "active" : ""}
          onClick={() => setTab("weight")}
        >
          ⚖️ 体重
        </button>
        <button
          className={tab === "goal" ? "active" : ""}
          onClick={() => setTab("goal")}
        >
          🎯 目標
        </button>
      </div>

      {tab === "workout" &&
        (isPlayer ? (
          <>
            <WorkoutForm memberId={member.id} memberName={member.name} />
            <TodayMenu memberId={member.id} memberName={member.name} />
          </>
        ) : (
          <div className="card">
            <p className="empty">
              トレーニング記録は本人の入力専用です。MAX・体重・目標のタブから部員を選んで一括入力できます。
            </p>
          </div>
        ))}
      {tab === "max" && <MaxForm members={members} initialId={initialId} />}
      {tab === "weight" && <WeightForm members={members} initialId={initialId} />}
      {tab === "goal" && <GoalForm members={members} initialId={initialId} />}
    </>
  );
}
