/** Apply the product's displayed-score floor after an optimization. */
export function applyOptimizedScoreFloor(
  baselineScore: number,
  optimizedScore: number
): number {
  const baseline = clampScore(baselineScore);
  const optimized = clampScore(optimizedScore);
  if (optimized > baseline) return optimized;

  const requiredIncrease = baseline < 50 ? 5 : baseline < 80 ? 3 : 0;

  return Math.min(100, baseline + requiredIncrease);
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
