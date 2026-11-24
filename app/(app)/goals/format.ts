export const DEFAULT_UNIT_LABEL = "checks";

export function formatCount(count: number, unitLabel: string | null | undefined) {
  return `${count} ${unitLabel?.trim() || DEFAULT_UNIT_LABEL}`;
}
