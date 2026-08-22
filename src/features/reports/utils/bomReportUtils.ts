import { BOMNode } from '@/features/projects/components/bomData';

// Lines over this lead time are flagged as long-lead exposure (12 weeks).
export const LONG_LEAD_THRESHOLD_DAYS = 84;

export interface BomCompleteness {
  pct: number;
  done: number;
  total: number;
}

export interface BomApprovalStatus {
  approved: number;
  pending: number;
  rejected: number;
  total: number;
  approvedPct: number;
}

export interface BomCostDriver {
  id: string;
  pn: string;
  desc: string;
  ext: number;
}

export interface BomSingleSourcePart {
  id: string;
  pn: string;
  desc: string;
  manufacturer: string;
  ext: number;
}

export interface BomLongLeadPart {
  id: string;
  pn: string;
  desc: string;
  leadTime: number;
}

export interface BomSupplierShare {
  name: string;
  pct: number;
  cost: number;
}

const extCost = (n: BOMNode) => n.price * n.qty;

export function getBomCompleteness(nodes: BOMNode[]): BomCompleteness {
  const total = nodes.length;
  const done = nodes.filter(
    (n) => n.mpn && n.manufacturer && n.distributor && n.price > 0 && n.leadTime > 0
  ).length;
  return { pct: total ? Math.round((done / total) * 100) : 0, done, total };
}

export function getBomApprovalStatus(nodes: BOMNode[]): BomApprovalStatus {
  const approved = nodes.filter((n) => n.status === 'approved').length;
  const pending = nodes.filter((n) => n.status === 'pending').length;
  const rejected = nodes.filter((n) => n.status === 'rejected').length;
  const total = approved + pending + rejected;
  return { approved, pending, rejected, total, approvedPct: total ? Math.round((approved / total) * 100) : 0 };
}

export function getBomBlockingCount(nodes: BOMNode[]): number {
  return nodes.filter((n) => n.status === 'pending' || n.status === 'rejected').length;
}

// Only sum root-level nodes (depth === 0) — their prices already include child rollup,
// so summing all flat nodes would double-count assembly costs.
export function getBomTotalCost(nodes: BOMNode[]): number {
  const roots = nodes.filter((n) => n.level === 0);
  const source = roots.length > 0 ? roots : nodes;
  return Math.round(source.reduce((sum, n) => sum + extCost(n), 0) * 100) / 100;
}

export function getBomCostDrivers(nodes: BOMNode[], limit = 10): BomCostDriver[] {
  return [...nodes]
    .map((n) => ({ id: n.id, pn: n.pn, desc: n.desc, ext: Math.round(extCost(n) * 100) / 100 }))
    .filter((d) => d.ext > 0)
    .sort((a, b) => b.ext - a.ext)
    .slice(0, limit);
}

// "Single-source" here means no distributor on file — the schema only tracks one
// manufacturer + one optional distributor per part, not a true multi-supplier model.
export function getBomSingleSourceParts(nodes: BOMNode[], limit = 5): { count: number; top: BomSingleSourcePart[] } {
  const matches = nodes.filter((n) => !n.distributor);
  const top = [...matches]
    .sort((a, b) => extCost(b) - extCost(a))
    .slice(0, limit)
    .map((n) => ({ id: n.id, pn: n.pn, desc: n.desc, manufacturer: n.manufacturer || 'Unknown', ext: Math.round(extCost(n) * 100) / 100 }));
  return { count: matches.length, top };
}

export function getBomLongLeadParts(
  nodes: BOMNode[],
  thresholdDays = LONG_LEAD_THRESHOLD_DAYS,
  limit = 5
): { count: number; top: BomLongLeadPart[] } {
  const matches = nodes.filter((n) => n.leadTime > thresholdDays);
  const top = [...matches]
    .sort((a, b) => b.leadTime - a.leadTime)
    .slice(0, limit)
    .map((n) => ({ id: n.id, pn: n.pn, desc: n.desc, leadTime: n.leadTime }));
  return { count: matches.length, top };
}

export function getBomSupplierConcentration(nodes: BOMNode[], limit = 5): BomSupplierShare[] {
  const totalCost = nodes.reduce((sum, n) => sum + extCost(n), 0);
  if (totalCost <= 0) return [];

  const byManufacturer = new Map<string, number>();
  for (const n of nodes) {
    const key = n.manufacturer || 'Unknown';
    byManufacturer.set(key, (byManufacturer.get(key) ?? 0) + extCost(n));
  }

  const sorted = [...byManufacturer.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, limit);
  const otherCost = sorted.slice(limit).reduce((sum, [, cost]) => sum + cost, 0);

  const shares: BomSupplierShare[] = top.map(([name, cost]) => ({
    name,
    cost,
    pct: Math.round((cost / totalCost) * 100),
  }));
  if (otherCost > 0) {
    shares.push({ name: 'Other', cost: otherCost, pct: Math.round((otherCost / totalCost) * 100) });
  }
  return shares;
}
