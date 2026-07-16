import { PillStyle } from './ecoData';
import { cn } from '@/lib/utils';

// ── Avatar ────────────────────────────────────────────────────────────────────

const PALETTE = [
  '#2563EB', '#9333EA', '#16A34A', '#D97706',
  '#DC2626', '#0891B2', '#DB2777', '#0D9488',
];

function hashIndex(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h * 31) + str.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ECOAvatar({ name, size = 24 }: { name: string; size?: number }) {
  const bg = PALETTE[hashIndex(name || '?')];
  return (
    <span
      title={name}
      className="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none"
      style={{
        width: size, height: size, background: bg,
        fontSize: Math.max(8, size * 0.38),
        lineHeight: 1,
      }}
    >
      {initials(name)}
    </span>
  );
}

// ── Status / priority pill ─────────────────────────────────────────────────────

export function StatusPill({ meta, className }: { meta: PillStyle; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap', className)}
      style={{ background: meta.background, color: meta.color, border: meta.border }}
    >
      {meta.label}
    </span>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
      {children}
    </div>
  );
}

// ── Inline input style helper ─────────────────────────────────────────────────
// Use this base className for all plain inputs/textareas in ECO forms
export const ecoInputCls =
  'w-full bg-muted/40 border border-border rounded-md text-foreground text-[13px] px-3 py-2 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 font-[inherit]';
