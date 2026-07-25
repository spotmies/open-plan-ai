import { config } from '@/config';

/**
 * Resolve a stored file reference to a full URL.
 *
 * If the value starts with "serve:" it's a backend-served S3 key:
 *   serve:attachments/organization/xxx.png
 *   → {API_BASE_URL}/uploads/serve/attachments%2Forganization%2Fxxx.png
 *
 * If it's already a full URL (http/https) return as-is.
 * Otherwise return null.
 */
export function resolveFileUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  if (value.startsWith('serve:')) {
    const key = value.slice('serve:'.length);
    const base = config.api.baseUrl.replace(/\/$/, '');
    return `${base}/uploads/serve/${encodeURIComponent(key)}`;
  }

  if (value.startsWith('drive-serve:')) {
    const attachmentId = value.slice('drive-serve:'.length);
    const base = config.api.baseUrl.replace(/\/$/, '');
    return `${base}/uploads/drive-serve/${encodeURIComponent(attachmentId)}`;
  }

  // Already a full URL — return unchanged
  if (value.startsWith('http://') || value.startsWith('https://')) {
    // Rewrite old localhost URLs to the current API base
    if (value.includes('localhost:3001')) {
      const match = value.match(/\/uploads\/serve\/(.+)$/);
      if (match) {
        const key = decodeURIComponent(match[1]);
        const base = config.api.baseUrl.replace(/\/$/, '');
        return `${base}/uploads/serve/${encodeURIComponent(key)}`;
      }
    }
    return value;
  }

  return null;
}
