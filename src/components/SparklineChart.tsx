import { Line, LineChart, ResponsiveContainer } from "recharts";

interface SparklineChartProps {
  data: number[];
  positive: boolean;
}

const SparklineChart = ({ data, positive }: SparklineChartProps) => {
  if (!data || data.length === 0) return null;

  const chartData = data.map((value, index) => ({ value, index }));
  const color = positive ? "hsl(var(--success))" : "hsl(var(--destructive))";

  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default SparklineChart;
