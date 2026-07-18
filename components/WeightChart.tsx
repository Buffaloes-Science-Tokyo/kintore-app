"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export type WeightDatum = { t: number; weight: number };

function fmtDate(t: number) {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtDateFull(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function WeightChart({ data }: { data: WeightDatum[] }) {
  if (data.length === 0) {
    return <p className="empty">条件に合う記録がありません</p>;
  }

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eceef1" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtDate}
            fontSize={12}
          />
          <YAxis
            fontSize={12}
            width={44}
            domain={["auto", "auto"]}
            label={{ value: "体重 (kg)", angle: -90, position: "insideLeft", fontSize: 11 }}
          />
          <Tooltip
            labelFormatter={(t) => fmtDateFull(Number(t))}
            formatter={(value) => [`${value} kg`, "体重"]}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#1d5cb5"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
