import type { BackendUser } from '@/services/auth.service';

/** Trim + lowercase (preserves +tags; used for storage and display normalization). */
export function normalizeInviteEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function gmailCanonicalLocalPart(local: string): string {
  const [beforePlus] = local.split('+');
  return (beforePlus || '').replace(/\./g, '');
}

/**
 * True if the signed-in account should be allowed to accept an invite sent to `invitedEmail`.
 * Handles Gmail / Googlemail dot-aliases and plus-addressing.
 */
export function emailsMatchForInvitation(invitedEmail: string, candidateEmail: string): boolean {
  const a = normalizeInviteEmail(invitedEmail);
  const b = normalizeInviteEmail(candidateEmail);
  if (!a || !b) return false;
  if (a === b) return true;

  const [la, da] = a.split('@');
  const [lb, db] = b.split('@');
  if (!la || !lb || !da || !db) return false;

  const domA = da === 'googlemail.com' ? 'gmail.com' : da;
  const domB = db === 'googlemail.com' ? 'gmail.com' : db;
  if (domA !== 'gmail.com' || domB !== 'gmail.com') return false;

  return gmailCanonicalLocalPart(la) === gmailCanonicalLocalPart(lb);
}

export function inviteMatchesAnyEmail(invitedEmail: string, candidates: string[]): boolean {
  const filtered = candidates.map((c) => normalizeInviteEmail(c)).filter(Boolean);
  return filtered.some((c) => emailsMatchForInvitation(invitedEmail, c));
}

/** Emails from the BackendUser object. */
export function candidateEmailsFromAuthUser(user: BackendUser): string[] {
  const out = new Set<string>();
  const add = (e: unknown) => {
    const n = normalizeInviteEmail(e);
    if (n) out.add(n);
  };
  add(user.email);
  return Array.from(out);
}
