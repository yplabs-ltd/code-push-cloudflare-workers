export function rolloutStrategy(
  clientId: string,
  rolloutPercentage: number,
  packageHash: string,
): boolean {
  // Create a deterministic but seemingly random value from 0-100
  const identifier = clientId + packageHash;
  const hashCode = Array.from(identifier).reduce((hash, char) => {
    return (hash << 5) - hash + char.charCodeAt(0);
  }, 0);

  const normalizedHash = Math.abs(hashCode % 100);
  return normalizedHash < rolloutPercentage;
}

export function isUnfinishedRollout(
  rollout: number | null | undefined,
): boolean {
  return typeof rollout === "number" && rollout > 0 && rollout < 100;
}

export function validateRollout(rollout: number): boolean {
  return Number.isInteger(rollout) && rollout >= 0 && rollout <= 100;
}

export function calculateRolloutPercentage(
  successfulInstalls: number,
  totalDevices: number,
): number {
  if (totalDevices === 0) return 0;
  return Math.round((successfulInstalls / totalDevices) * 100);
}
