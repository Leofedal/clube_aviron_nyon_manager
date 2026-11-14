"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonthKey } from "@/lib/time";

const nf = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 1 });

/** Infobulle sobre (texte en encre neutre, la couleur identifie seulement la marque). */
function ChartTooltip({
  active,
  payload,
  label,
  unit,
  labelFormatter,
}: {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string | number;
  unit: string;
  labelFormatter?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <div className="text-muted-foreground">{labelFormatter ? labelFormatter(String(label)) : label}</div>
      <div className="font-semibold tabular">
        {nf.format(Number(payload[0].value ?? 0))} {unit}
      </div>
    </div>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
} as const;

/** Barres verticales par mois (une seule série). */
export function MonthlyBarChart({
  data,
  dataKey,
  unit,
  height = 240,
}: {
  data: { month: string; [k: string]: number | string }[];
  dataKey: string;
  unit: string;
  height?: number;
}) {
  return (
    <div style={{ height }} role="img" aria-label={`Graphique : ${unit} par mois`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={formatMonthKey} {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} allowDecimals={false} width={44} tickFormatter={(v) => nf.format(v)} />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.5 }}
            content={<ChartTooltip unit={unit} labelFormatter={formatMonthKey} />}
          />
          <Bar dataKey={dataKey} isAnimationActive={false} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barres horizontales classées (bateaux, membres). */
export function RankedBarChart({
  data,
  unit,
  height,
}: {
  data: { label: string; value: number }[];
  unit: string;
  height?: number;
}) {
  const h = height ?? Math.max(160, data.length * 30 + 20);
  return (
    <div style={{ height: h }} role="img" aria-label={`Classement en ${unit}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" {...axisProps} tickFormatter={(v) => nf.format(v)} />
          <YAxis type="category" dataKey="label" {...axisProps} width={110} tick={{ fill: "var(--foreground)", fontSize: 12 }} />
          <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} content={<ChartTooltip unit={unit} />} />
          <Bar dataKey="value" isAnimationActive={false} fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
