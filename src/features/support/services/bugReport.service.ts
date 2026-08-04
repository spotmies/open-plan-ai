import { config } from '@/config';
import { logger } from '@/services/monitoring/logger';

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file
export const MAX_TOTAL_ATTACHMENTS_SIZE_BYTES = 25 * 1024 * 1024; // 25MB total

interface SubmitBugReportInput {
  title: string;
  description: string;
  customer: { name: string; email: string };
  pageUrl: string;
  files: File[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function validateAttachments(files: File[]): string | null {
  if (files.length > MAX_ATTACHMENTS) {
    return `You can attach up to ${MAX_ATTACHMENTS} files.`;
  }
  const oversizeFile = files.find((f) => f.size > MAX_ATTACHMENT_SIZE_BYTES);
  if (oversizeFile) {
    return `"${oversizeFile.name}" is larger than 10MB.`;
  }
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_ATTACHMENTS_SIZE_BYTES) {
    return 'Total attachment size must be under 25MB.';
  }
  return null;
}

const SUPPORT_API_URL = 'https://api.openplanai.com/api/v1';
const SUPPORT_API_KEY = 'sk_live_Rk-9j8ZiValp99G4roSSR3KQT9t3Mbda';

export async function submitBugReport(input: SubmitBugReportInput): Promise<string> {
  const attachments = await Promise.all(
    input.files.map(async (file) => ({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      contentBase64: await fileToBase64(file),
    })),
  );

  const description = [
    input.description,
    '---',
    `Page: ${input.pageUrl}`,
    `App version: ${config.app.version}`,
    `User agent: ${navigator.userAgent}`,
  ].join('\n');

  const res = await fetch(`${SUPPORT_API_URL}/support/tickets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPPORT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      description,
      customer: input.customer,
      ...(attachments.length > 0 && { attachments }),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error?.message || body?.message || 'Failed to submit bug report.';
    logger.error('Bug report submission failed', { status: res.status, message });
    throw new Error(message);
  }

  const { data } = await res.json();
  return data.id as string;
}
