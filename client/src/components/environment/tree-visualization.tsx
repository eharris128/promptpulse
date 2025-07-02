"use client";

interface TreeVisualizationProps {
  impact: {
    co2Grams: number
    energyWh: number
    waterLiters: number
    inputTokens: number
    outputTokens: number
  }
}

export function TreeVisualization({ impact }: TreeVisualizationProps) {
  // Calculate tree size based on CO2 impact (0-100 scale)
  const maxCO2 = 10000; // 10kg as reasonable max for scaling
  const impactScale = Math.min(impact.co2Grams / maxCO2, 1);

  // Tree grows from 30% to 100% based on impact
  const treeScale = 0.3 + (impactScale * 0.7);

  // Color intensity based on impact (green to yellow to red)
  const getTreeColor = (scale: number) => {
    if (scale < 0.3) return "#22c55e"; // Green
    if (scale < 0.6) return "#eab308"; // Yellow
    return "#ef4444"; // Red
  };

  const treeColor = getTreeColor(impactScale);
  const leafOpacity = 0.4 + (impactScale * 0.6);

  return (
    <div className="flex items-center justify-center h-64 bg-gradient-to-b from-sky-50 to-green-50 dark:from-sky-900/20 dark:to-green-900/20 rounded-lg">
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        className="drop-shadow-sm"
      >
        {/* Tree trunk */}
        <rect
          x="90"
          y={120 + (40 * (1 - treeScale))}
          width="20"
          height={60 * treeScale}
          fill="#8b4513"
          rx="2"
        />

        {/* Tree crown - main body */}
        <ellipse
          cx="100"
          cy={100 - (20 * (treeScale - 0.3))}
          rx={40 * treeScale}
          ry={35 * treeScale}
          fill={treeColor}
          opacity={leafOpacity}
        />

        {/* Tree crown - upper layer for depth */}
        <ellipse
          cx="95"
          cy={90 - (15 * (treeScale - 0.3))}
          rx={35 * treeScale}
          ry={30 * treeScale}
          fill={treeColor}
          opacity={leafOpacity + 0.1}
        />

        {/* Tree crown - top layer */}
        <ellipse
          cx="105"
          cy={85 - (10 * (treeScale - 0.3))}
          rx={25 * treeScale}
          ry={20 * treeScale}
          fill={treeColor}
          opacity={leafOpacity + 0.2}
        />

        {/* Ground line */}
        <line
          x1="20"
          y1="180"
          x2="180"
          y2="180"
          stroke="#22c55e"
          strokeWidth="2"
          opacity="0.3"
        />

        {/* Small grass elements */}
        {[...Array(5)].map((_, i) => (
          <line
            key={i}
            x1={30 + i * 30}
            y1="180"
            x2={32 + i * 30}
            y2="175"
            stroke="#22c55e"
            strokeWidth="1"
            opacity="0.4"
          />
        ))}
      </svg>

      <div className="ml-6 text-center">
        <div className="text-2xl font-bold text-foreground mb-2">
          {impact.co2Grams < 1000
            ? `${impact.co2Grams.toFixed(1)}g`
            : `${(impact.co2Grams / 1000).toFixed(2)}kg`}
        </div>
        <div className="text-sm text-muted-foreground">CO₂ equivalent</div>

        <div className="mt-4 text-xs text-muted-foreground">
          {impactScale < 0.3 && "🌱 Low impact"}
          {impactScale >= 0.3 && impactScale < 0.6 && "🌿 Moderate impact"}
          {impactScale >= 0.6 && "🌳 High impact"}
        </div>
      </div>
    </div>
  );
}
