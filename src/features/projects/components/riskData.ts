export type RiskStatus = 'open' | 'mitigated' | 'monitoring';

export interface RiskDot {
  id: string;
  prob: number;   // 1–5
  impact: number; // 1–5
}

export interface Risk {
  id: string;
  desc: string;
  score: number;
  owner: string;
  ownerIdx: number;
  status: RiskStatus;
  category: string;
}

export interface HeatmapCell {
  bg: string;
  border: string;
}

// Heatmap cell color — probability × impact score bands
export function heatmapCell(prob: number, impact: number): HeatmapCell {
  const s = prob * impact;
  if (s >= 20) return { bg: 'hsl(var(--status-blocked) / 0.28)', border: 'hsl(var(--status-blocked) / 0.5)' };
  if (s >= 15) return { bg: 'hsl(var(--status-blocked) / 0.14)', border: 'hsl(var(--status-blocked) / 0.28)' };
  if (s >= 10) return { bg: 'hsl(var(--priority-high)  / 0.22)', border: 'hsl(var(--priority-high)  / 0.38)' };
  if (s >= 6)  return { bg: 'hsl(var(--priority-high)  / 0.10)', border: 'hsl(var(--priority-high)  / 0.22)' };
  if (s >= 3)  return { bg: 'hsl(var(--status-done)    / 0.12)', border: 'hsl(var(--status-done)    / 0.22)' };
  return         { bg: 'hsl(var(--status-done)    / 0.05)', border: 'hsl(var(--status-done)    / 0.14)' };
}

// Score badge color token string (for inline HSL)
export function scoreTokenHsl(score: number): string {
  if (score >= 20) return 'var(--status-blocked)';
  if (score >= 10) return 'var(--priority-high)';
  if (score >= 5)  return 'var(--status-in-progress)';
  return 'var(--status-done)';
}

export const RISK_STATUS_META: Record<RiskStatus, { token: string; label: string }> = {
  open:       { token: '--status-blocked',     label: 'Open' },
  mitigated:  { token: '--status-done',        label: 'Mitigated' },
  monitoring: { token: '--status-in-progress', label: 'Monitoring' },
};

export const RISK_OWNER_PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--status-review))',
];

export const RISK_DOTS: RiskDot[] = [
  { id: 'R-001', prob: 5, impact: 5 }, { id: 'R-007', prob: 5, impact: 4 },
  { id: 'R-014', prob: 4, impact: 5 }, { id: 'R-003', prob: 4, impact: 4 },
  { id: 'R-009', prob: 3, impact: 5 }, { id: 'R-002', prob: 4, impact: 3 },
  { id: 'R-011', prob: 3, impact: 3 }, { id: 'R-005', prob: 2, impact: 4 },
  { id: 'R-016', prob: 2, impact: 3 }, { id: 'R-008', prob: 1, impact: 4 },
  { id: 'R-013', prob: 2, impact: 2 }, { id: 'R-017', prob: 1, impact: 3 },
  { id: 'R-019', prob: 1, impact: 2 }, { id: 'R-020', prob: 1, impact: 1 },
  { id: 'R-018', prob: 2, impact: 1 },
];

export const RISKS: Risk[] = [
  { id: 'R-001', desc: 'MCU supply shortage — 16-week lead time',   score: 25, owner: 'Dr. Patel',    ownerIdx: 1, status: 'open',       category: 'Supply Chain' },
  { id: 'R-007', desc: '4G modem FCC certification delay',           score: 20, owner: 'Marcus Webb',  ownerIdx: 4, status: 'open',       category: 'Regulatory' },
  { id: 'R-014', desc: 'Magnesium housing tooling cost overrun',     score: 20, owner: 'Sarah Chen',   ownerIdx: 0, status: 'open',       category: 'Cost' },
  { id: 'R-003', desc: 'Thermal runaway in power module',            score: 16, owner: 'James Okafor', ownerIdx: 3, status: 'mitigated',  category: 'Safety' },
  { id: 'R-009', desc: 'OCPP 2.0.1 interoperability failure',        score: 15, owner: 'Linda Torres', ownerIdx: 5, status: 'open',       category: 'Software' },
  { id: 'R-002', desc: 'IP65 sealing failure in field testing',      score: 12, owner: 'Sarah Chen',   ownerIdx: 0, status: 'mitigated',  category: 'Quality' },
  { id: 'R-011', desc: 'Key supplier (Infineon) capacity risk',      score: 9,  owner: 'Dr. Patel',    ownerIdx: 1, status: 'mitigated',  category: 'Supply Chain' },
  { id: 'R-005', desc: 'Payment terminal PCI DSS audit delay',       score: 8,  owner: 'Linda Torres', ownerIdx: 5, status: 'open',       category: 'Regulatory' },
  { id: 'R-016', desc: 'Pilot build schedule slip > 2 weeks',        score: 6,  owner: 'James Okafor', ownerIdx: 3, status: 'monitoring', category: 'Schedule' },
  { id: 'R-008', desc: 'CAN bus EMI interference',                   score: 4,  owner: 'Marcus Webb',  ownerIdx: 4, status: 'mitigated',  category: 'Hardware' },
  { id: 'R-013', desc: 'Documentation delays for CE marking',        score: 4,  owner: 'TBD',          ownerIdx: 2, status: 'monitoring', category: 'Regulatory' },
  { id: 'R-017', desc: 'Pedestal mounting corrosion risk',           score: 3,  owner: 'Sarah Chen',   ownerIdx: 0, status: 'mitigated',  category: 'Quality' },
];
