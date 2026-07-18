"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type FilterField = {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  /** このフィルタを変更したときにリセットする他のパラメータ名（例: ポジション変更→部員をリセット） */
  resets?: string[];
};

export default function FilterBar({ fields }: { fields: FilterField[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(field: FilterField, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(field.name, value);
    } else {
      params.delete(field.name);
    }
    for (const name of field.resets ?? []) {
      params.delete(name);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="filter-bar">
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          <select value={f.value} onChange={(e) => update(f, e.target.value)}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
