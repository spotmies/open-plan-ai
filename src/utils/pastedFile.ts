// Browsers hand clipboard-pasted images to the File API with a generic, non-descriptive
// name (Chrome/Edge/Firefox all use "image.png" regardless of source) — every paste in a
// single session looks identical in an attachment list. Give those a distinct, readable
// name; leave files that already carry a real name (e.g. a file copied from Explorer/Finder)
// untouched.
const GENERIC_PASTE_NAME = /^image\.\w+$/i;

export const isGenericPastedFileName = (name: string) => !name.trim() || GENERIC_PASTE_NAME.test(name.trim());

export function renamePastedImageFile(file: File, index = 0): File {
  if (!isGenericPastedFileName(file.name)) return file;

  const ext = file.type.split('/')[1]?.split('+')[0] || 'png';
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const suffix = index > 0 ? `-${index + 1}` : '';
  const name = `Image ${stamp}${suffix}.${ext}`;

  return new File([file], name, { type: file.type, lastModified: file.lastModified });
}
