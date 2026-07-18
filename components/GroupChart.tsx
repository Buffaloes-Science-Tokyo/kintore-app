"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import type { GroupDatum, SeriesKey } from "@/lib/groupSeries";

const COLORS = [
  "#94a3b8",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#f87171",
  "#38bdf8",
  "#4ade80",
  "#fb923c",
  "#2dd4bf",
  "#c084fc",
];

function fmtMonth(t: number) {
  const d = new Date(t);
  return `${d.getFullYear() !== new Date().getFullYear() ? `${String(d.getFullYear()).slice(2)}/` : ""}${d.getMonth() + 1}月`;
}

/** グループ表示: 個人の線（細）＋グループ平均の線（太いオレンジ） */
export default function GroupChart({
  data,
  seriesKeys,
  yLabel,
  unit,
}: {
  data: GroupDatum[];
  seriesKeys: SeriesKey[];
  yLabel: string;
  unit: string;
}) {
  if (data.length === 0 || seriesKeys.length === 0) {
    return <p className="empty">条件に合う記録がありません</p>;
  }

  return (
    <div style={{ width: "100%", height: 380 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eceef1" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtMonth}
            fontSize={12}
          />
          <YAxis
            fontSize={12}
            width={48}
            domain={["auto", "auto"]}
            label={{ value: `${yLabel} (${unit})`, angle: -90, position: "insideLeft", fontSize: 11 }}
          />
          <Tooltip
            labelFormatter={(t) => fmtMonth(Number(t))}
            formatter={(value, name) => [`${value} ${unit}`, name]}
          />
          <Legend />
          {seriesKeys.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              strokeOpacity={0.55}
              dot={{ r: 2 }}
              connectNulls
            />
          ))}
          <Line
            type="monotone"
            dataKey="avg"
            name="グループ平均"
            stroke="#d94a2b"
            strokeWidth={3.5}
            dot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
