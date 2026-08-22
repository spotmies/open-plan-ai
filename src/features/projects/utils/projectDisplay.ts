/**
 * Presentation helpers shared by the projects list and the project workspace,
 * so a stage badge or a department label reads the same wherever it appears.
 */

export const stageColors = {
  concept: 'bg-muted text-muted-foreground',
  design: 'bg-chart-1/10 text-chart-1',
  development: 'bg-chart-2/10 text-chart-2',
  testing: 'bg-chart-4/10 text-chart-4',
  production: 'bg-chart-3/10 text-chart-3',
};

export const stageLabels = {
  concept: 'Concept',
  design: 'Design',
  development: 'Development',
  testing: 'Testing',
  production: 'Production',
};

// Mirrors the department list in NewProject.tsx / EditProject.tsx
export const departmentLabels: Record<string, string> = {
  design: 'Design',
  hardware: 'Hardware',
  software: 'Software',
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  firmware: 'Firmware',
  testing: 'Testing & QA',
  manufacturing: 'Manufacturing',
  documentation: 'Documentation',
};

export const formatDepartmentLabel = (id: string) => {
  if (departmentLabels[id]) return departmentLabels[id];
  const cleaned = id.startsWith('custom-') ? id.slice('custom-'.length) : id;
  return cleaned.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const formatDisplayDate = (value?: string | number | Date | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

export const getAttachmentMimeType = (attachment: any): string => {
  const mime = attachment?.mimeType || attachment?.mime_type;
  if (mime) return mime;
  const name: string = attachment?.file_name || attachment?.fileName || attachment?.name || '';
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return `image/${ext}`;
  return '';
};

export const isImageAttachment = (attachment: any) =>
  getAttachmentMimeType(attachment).startsWith('image/');
