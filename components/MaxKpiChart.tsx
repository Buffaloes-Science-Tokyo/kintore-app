"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export type MaxKpiDatum = {
  t: number;
  max?: number;
  kpi?: number;
  injured?: boolean; // 怪我で測定できず、前回の値を引き継いだ点
};

/** MAXの点: 怪我の月はグレーの点＋🩹怪我ラベル */
function MaxDot(props: {
  cx?: number;
  cy?: number;
  payload?: MaxKpiDatum;
  index?: number;
}) {
  const { cx, cy, payload, index } = props;
  if (cx === undefined || cy === undefined || payload?.max === undefined) {
    return <g key={`dot-${index}`} />;
  }
  if (payload.injured) {
    return (
      <g key={`dot-${index}`}>
        <circle cx={cx} cy={cy} r={4} fill="#fff" stroke="#94a3b8" strokeWidth={2} />
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill="#dc2626"
        >
          🩹怪我
        </text>
      </g>
    );
  }
  return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#d94a2b" />;
}

function fmtDate(t: number) {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtDateFull(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function MaxKpiChart({
  data,
  kpiName,
  kpiUnit,
}: {
  data: MaxKpiDatum[];
  kpiName: string; // 空文字ならMAXのみ表示
  kpiUnit: string;
}) {
  if (data.length === 0) {
    return <p className="empty">条件に合う記録がありません</p>;
  }

  const showKpi = kpiName !== "";

  return (
    <div style={{ width: "100%", height: 340 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 16, right: 28, left: 0, bottom: 0 }}>
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
            yAxisId="max"
            fontSize={12}
            width={44}
            domain={["auto", "auto"]}
            label={{ value: "MAX (kg)", angle: -90, position: "insideLeft", fontSize: 11 }}
          />
          {showKpi && (
            <YAxis
              yAxisId="kpi"
              orientation="right"
              fontSize={12}
              width={54}
              domain={["auto", "auto"]}
              label={{ value: `${kpiName} (${kpiUnit})`, angle: 90, position: "insideRight", fontSize: 11 }}
            />
          )}
          <Tooltip
            labelFormatter={(t) => fmtDateFull(Number(t))}
            formatter={(value, name, item) => [
              `${value} ${name === "MAX" ? "kg" : kpiUnit}${
                name === "MAX" && item?.payload?.injured
                  ? "（🩹怪我・前回値を引き継ぎ）"
                  : ""
              }`,
              name,
            ]}
          />
          <Legend />
          <Line
            yAxisId="max"
            type="monotone"
            dataKey="max"
            name="MAX"
            stroke="#d94a2b"
            strokeWidth={2.5}
            dot={<MaxDot />}
            connectNulls
          />
          {showKpi && (
            <Line
              yAxisId="kpi"
              type="monotone"
              dataKey="kpi"
              name={kpiName}
              stroke="#1d5cb5"
              strokeWidth={2}
              dot={{ r: 2 }}
              strokeDasharray="1 0"
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
