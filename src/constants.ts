export const SLA_HOURS = {
  critical: 4,
  high: 8,
  medium: 24,
  low: 48
} as const;

export const SLA_LABELS = {
  critical: 'Critical (4h)',
  high: 'High (8h)',
  medium: 'Medium (24h)',
  low: 'Low (48h)'
} as const;
