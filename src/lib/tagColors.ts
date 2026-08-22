// Fallback only — used for a tag that hasn't round-tripped through the
// project's tag registry yet (e.g. optimistic UI right after creating it,
// or before useProjectTags has loaded). Once the registry is loaded, every
// tag's real color comes from there, so the same tag name renders
// identically everywhere it's used (issues, tasks, modules, ...).
export const FALLBACK_TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
];

export function getFallbackTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_TAG_COLORS[Math.abs(hash) % FALLBACK_TAG_COLORS.length];
}
