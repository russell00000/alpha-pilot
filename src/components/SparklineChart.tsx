import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface SparklineChartProps {
  data: number[];
  positive: boolean;
}

const normalizeSeries = (series: number[]) => {
  const min = Math.min(...series);
  const max = Math.max(...series);

  // Avoid flat-line when min≈max
  if (max - min < 0.0001) {
    return series.map((_, i) => ({ value: 50, index: i }));
  }

  // Add a tiny padding so the line doesn't stick to edges
  const padding = (max - min) * 0.08;
  const lo = min - padding;
  const hi = max + padding;

  return series.map((v, i) => ({
    index: i,
    value: ((v - lo) / (hi - lo)) * 100,
  }));
};

const SparklineChart = ({ data, positive }: SparklineChartProps) => {
  if (!data || data.length === 0) return null;

  const chartData = normalizeSeries(data);
  const strokeColor = positive ? "hsl(var(--success))" : "hsl(var(--destructive))";

  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`gradient-${positive ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <Area
          type="linear"
          dataKey="value"
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinejoin="miter"
          strokeLinecap="butt"
          fill={`url(#gradient-${positive ? "up" : "down"})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default SparklineChart;
