// セット単位の記録を「同じ日 × 部員 × 種目」のセッションにまとめる

export type SetRow = {
  date: Date;
  exercise: string;
  bodyPart?: string | null;
  setNumber: number;
  weightKg: number;
  reps: number;
  member: { name: string };
};

export type Session = {
  key: string;
  date: Date;
  memberName: string;
  exercise: string;
  bodyPart: string | null;
  sets: { weightKg: number; reps: number }[];
  volume: number;
};

export function groupSessions(logs: SetRow[]): Session[] {
  const map = new Map<string, Session>();
  for (const log of logs) {
    const key = `${log.date.toISOString().slice(0, 10)}|${log.member.name}|${log.exercise}`;
    let session = map.get(key);
    if (!session) {
      session = {
        key,
        date: log.date,
        memberName: log.member.name,
        exercise: log.exercise,
        bodyPart: log.bodyPart ?? null,
        sets: [],
        volume: 0,
      };
      map.set(key, session);
    }
    session.sets.push({ weightKg: log.weightKg, reps: log.reps });
    session.volume += log.weightKg * log.reps;
  }
  return [...map.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function formatSets(sets: { weightKg: number; reps: number }[]): string {
  return sets.map((s) => `${s.weightKg}×${s.reps}`).join(" / ");
}
