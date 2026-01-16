import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface SparklineChartProps {
  data: number[];
  positive: boolean;
}

const SparklineChart = ({ data, positive }: SparklineChartProps) => {
  if (!data || data.length === 0) return null;

  const chartData = data.map((value, index) => ({ value, index }));
  const strokeColor = positive ? "hsl(var(--success))" : "hsl(var(--destructive))";
  const fillColor = positive ? "hsl(var(--success) / 0.15)" : "hsl(var(--destructive) / 0.15)";

  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`gradient-${positive ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
            <stop 
              offset="0%" 
              stopColor={strokeColor} 
              stopOpacity={0.3} 
            />
            <stop 
              offset="100%" 
              stopColor={strokeColor} 
              stopOpacity={0.02} 
            />
          </linearGradient>
        </defs>
        <Area
          type="monotoneX"
          dataKey="value"
          stroke={strokeColor}
          strokeWidth={1.5}
          fill={`url(#gradient-${positive ? 'up' : 'down'})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default SparklineChart;
