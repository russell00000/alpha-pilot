interface SparklineChartProps {
  data: number[];
  positive: boolean;
}

const normalizeSeries = (series: number[]) => {
  const min = Math.min(...series);
  const max = Math.max(...series);

  // Avoid flat-line when min≈max
  if (max - min < 0.0001) {
    return series.map((_, i) => ({ x: i, y: 50 }));
  }

  // Add a tiny padding so the line doesn't stick to edges
  const padding = (max - min) * 0.08;
  const lo = min - padding;
  const hi = max + padding;

  return series.map((v, i) => ({ x: i, y: ((v - lo) / (hi - lo)) * 100 }));
};

const SparklineChart = ({ data, positive }: SparklineChartProps) => {
  if (!data || data.length === 0) return null;

  const chartData = normalizeSeries(data);
  const strokeColor = positive ? "hsl(var(--success))" : "hsl(var(--destructive))";
  const width = 120;
  const height = 40;
  const points = chartData
    .map((point, index) => {
      const x = chartData.length === 1 ? width / 2 : (index / (chartData.length - 1)) * width;
      const y = height - (point.y / 100) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={areaPoints} fill={strokeColor} opacity="0.1" />
      <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export default SparklineChart;
