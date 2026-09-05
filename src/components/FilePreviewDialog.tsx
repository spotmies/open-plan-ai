import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Download, Copy, File as FileIcon, ExternalLink, ChevronLeft, ChevronRight, X, Loader2, Video, ZoomIn, ZoomOut, Share2 } from 'lucide-react';
import { toast } from 'sonner';
// xlsx / docx-preview / pptx-preview are loaded via dynamic import() inside their
// respective effects below — they're 600KB+ combined (mostly pptx-preview's echarts
// dependency) and must not bloat the chunk every file preview (image, PDF, video) pays for.
import type * as XLSXType from 'xlsx';
import { ImageWithProgress } from '@/components/shared/ImageWithProgress';
import { logger } from '@/services/monitoring/logger';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v'];
const OFFICE_EXTENSIONS = ['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt'];
const OFFICE_MIME_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

function extOf(fileName: string, url: string): string {
  // Strip query/hash from the URL only — a file *name* may legitimately contain
  // '#', and one starting with it collapsed to '' here and lost its extension.
  const source = fileName || url.split(/[?#]/)[0];
  return source.split('.').pop()?.toLowerCase() ?? '';
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

function getEmbedUrl(url: string): string | null {
  const ytId = getYouTubeId(url);
  if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1`;
  const vimeoId = getVimeoId(url);
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
  return null;
}

// Microsoft's viewer fetches the file itself, so this only renders when `url`
// is reachable from the public internet (not localhost/dev environments).
function getOfficeViewerUrl(url: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

export function getVideoThumbnail(url: string): string | null {
  const ytId = getYouTubeId(url);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  return null;
}

export function isVideoUrl(url: string): boolean {
  if (getYouTubeId(url) || getVimeoId(url)) return true;
  const ext = extOf('', url);
  return VIDEO_EXTENSIONS.includes(ext);
}

function kindOf(fileName: string, url: string, mimeType?: string | null): 'image' | 'pdf' | 'video' | 'embed' | 'office' | 'other' {
  // Check for embed URLs first (YouTube, Vimeo) before generic video/* check
  if (getEmbedUrl(url)) return 'embed';
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType && OFFICE_MIME_TYPES.includes(mimeType)) return 'office';
  const ext = extOf(fileName, url);
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (OFFICE_EXTENSIONS.includes(ext)) return 'office';
  return 'other';
}

// Which office files can be rendered client-side (no public URL needed) vs.
// need the Microsoft Office Online iframe fallback (legacy .doc/.ppt binary formats
// have no viable client-side parser).
function officeSubKindOf(fileName: string, url: string, mimeType?: string | null): 'spreadsheet' | 'word' | 'slideshow' | 'unsupported' {
  const ext = extOf(fileName, url);
  if (ext === 'xlsx' || ext === 'xls' || mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return 'spreadsheet';
  }
  if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'word';
  }
  // pptx-preview parses the OOXML zip format — legacy binary .ppt isn't supported.
  if (ext === 'pptx' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return 'slideshow';
  }
  return 'unsupported';
}

export interface FilePreviewTarget {
  url: string;
  fileName: string;
  mimeType?: string | null;
}

export function FilePreviewDialog({
  file,
  files,
  initialIndex,
  onClose,
}: {
  file: FilePreviewTarget | null;
  files?: FilePreviewTarget[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const list = file && files && files.length > 1 ? files : null;

  const startIdx = (() => {
    if (initialIndex !== undefined && list) return initialIndex;
    if (file && list) {
      const idx = list.findIndex(f => f.url === file.url);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  })();

  const [currentIdx, setCurrentIdx] = useState(startIdx);

  useEffect(() => {
    setCurrentIdx(startIdx);
  }, [startIdx]);

  const current = list ? list[currentIdx] : file;

  const goPrev = useCallback(() => {
    if (!list) return;
    setCurrentIdx(i => (i - 1 + list.length) % list.length);
  }, [list]);

  const goNext = useCallback(() => {
    if (!list) return;
    setCurrentIdx(i => (i + 1) % list.length);
  }, [list]);

  useEffect(() => {
    if (!list) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [list, goPrev, goNext]);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobLoading, setBlobLoading] = useState(false);
  // Why the fetch failed, shown in the error state — a bare "unable to preview"
  // is a dead end for the user and for anyone debugging it.
  const [blobError, setBlobError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [pdfError, setPdfError] = useState(false);
  const [pdfScale, setPdfScale] = useState(1);
  const [pdfContainerWidth, setPdfContainerWidth] = useState(800);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNumPages(0);
    setPdfError(false);
    setPdfScale(1);
  }, [current?.url]);

  useEffect(() => {
    const el = pdfContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) setPdfContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!current) return;
    const kind = kindOf(current.fileName, current.url, current.mimeType);
    if (kind !== 'pdf') return;

    setBlobUrl(null);
    setBlobError(null);
    setBlobLoading(true);
    let cancelled = false;

    fetch(current.url, { credentials: 'include' })
      .then(r => {
        // Without this an error response's JSON/HTML body was wrapped in a blob
        // and handed to react-pdf, which then reported the *file* as unreadable
        // and hid the real failure (missing object, expired session, …).
        if (!r.ok) throw new Error(`Server returned ${r.status} ${r.statusText}`);
        return r.blob();
      })
      .then(blob => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch((err) => {
        logger.error('Failed to fetch file for preview:', current.url, err);
        if (cancelled) return;
        setBlobUrl(null);
        setBlobError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setBlobLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [current?.url]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // Spreadsheets, Word docs, and .pptx slideshows render fully client-side (no public
  // URL required) — legacy .doc / .ppt fall back to the Office Online iframe further down.
  const [officeLoading, setOfficeLoading] = useState(false);
  const [officeError, setOfficeError] = useState(false);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const workbookRef = useRef<XLSXType.WorkBook | null>(null);
  const xlsxModuleRef = useRef<typeof XLSXType | null>(null);
  const wordContainerRef = useRef<HTMLDivElement | null>(null);
  const pptxContainerRef = useRef<HTMLDivElement | null>(null);
  const pptxPreviewerRef = useRef<{ destroy(): void; preview(file: ArrayBuffer): Promise<unknown> } | null>(null);

  useEffect(() => {
    if (!current) return;
    const kind = kindOf(current.fileName, current.url, current.mimeType);
    const subKind = kind === 'office' ? officeSubKindOf(current.fileName, current.url, current.mimeType) : null;

    setOfficeError(false);
    if (subKind !== 'spreadsheet') {
      workbookRef.current = null;
      setSheetNames([]);
      return;
    }

    setOfficeLoading(true);
    setSheetNames([]);
    setActiveSheet(0);
    let cancelled = false;

    Promise.all([
      fetch(current.url, { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error(`Failed to fetch file: ${r.status}`);
        return r.arrayBuffer();
      }),
      import('xlsx'),
    ])
      .then(([buf, XLSX]) => {
        if (cancelled) return;
        xlsxModuleRef.current = XLSX;
        const workbook = XLSX.read(buf, { type: 'array' });
        workbookRef.current = workbook;
        setSheetNames(workbook.SheetNames);
      })
      .catch(err => {
        logger.warn('Failed to render spreadsheet preview', err);
        if (!cancelled) setOfficeError(true);
      })
      .finally(() => {
        if (!cancelled) setOfficeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [current?.url]);

  const activeSheetHtml = useMemo(() => {
    const workbook = workbookRef.current;
    const XLSX = xlsxModuleRef.current;
    const sheetName = sheetNames[activeSheet];
    if (!workbook || !XLSX || !sheetName) return '';
    return XLSX.utils.sheet_to_html(workbook.Sheets[sheetName]);
  }, [sheetNames, activeSheet]);

  useEffect(() => {
    if (!current || !wordContainerRef.current) return;
    const kind = kindOf(current.fileName, current.url, current.mimeType);
    const subKind = kind === 'office' ? officeSubKindOf(current.fileName, current.url, current.mimeType) : null;
    if (subKind !== 'word') return;

    const container = wordContainerRef.current;
    container.innerHTML = '';
    setOfficeLoading(true);
    setOfficeError(false);
    let cancelled = false;

    Promise.all([
      fetch(current.url, { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error(`Failed to fetch file: ${r.status}`);
        return r.blob();
      }),
      import('docx-preview'),
    ])
      .then(([blob, mod]) => {
        if (cancelled) return;
        // Guard the interop shape: the package is ESM-only, so a bundler that
        // wraps it hands back the namespace under `default` instead.
        const renderAsync = mod.renderAsync ?? (mod as unknown as { default?: typeof mod }).default?.renderAsync;
        if (typeof renderAsync !== 'function') {
          throw new Error('docx-preview: renderAsync export not found');
        }
        return renderAsync(blob, container, container, { inWrapper: true, ignoreWidth: true });
      })
      .then(() => {
        if (cancelled) return;
        // renderAsync can resolve having appended nothing (a document it can't
        // parse, or one whose body is empty). Without this the pane just sits
        // blank with no spinner and no error, which reads as a hung preview.
        if (!container.querySelector('.docx-wrapper, .docx')) {
          throw new Error('docx-preview rendered no content');
        }
      })
      .catch(err => {
        logger.warn('Failed to render docx preview', err);
        if (!cancelled) setOfficeError(true);
      })
      .finally(() => {
        if (!cancelled) setOfficeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [current?.url]);

  useEffect(() => {
    if (!current || !pptxContainerRef.current) return;
    const kind = kindOf(current.fileName, current.url, current.mimeType);
    const subKind = kind === 'office' ? officeSubKindOf(current.fileName, current.url, current.mimeType) : null;
    if (subKind !== 'slideshow') return;

    const container = pptxContainerRef.current;
    container.innerHTML = '';
    pptxPreviewerRef.current?.destroy();
    pptxPreviewerRef.current = null;
    setOfficeLoading(true);
    setOfficeError(false);
    let cancelled = false;

    Promise.all([
      fetch(current.url, { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error(`Failed to fetch file: ${r.status}`);
        return r.arrayBuffer();
      }),
      import('pptx-preview'),
    ])
      .then(([buf, { init }]) => {
        if (cancelled) return;
        const previewer = init(container, { width: 960, height: 540, mode: 'list' });
        pptxPreviewerRef.current = previewer;
        return previewer.preview(buf);
      })
      .catch(err => {
        logger.warn('Failed to render pptx preview', err);
        if (!cancelled) setOfficeError(true);
      })
      .finally(() => {
        if (!cancelled) setOfficeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [current?.url]);

  useEffect(() => {
    return () => {
      pptxPreviewerRef.current?.destroy();
    };
  }, []);

  const handleShare = useCallback(async () => {
    if (!current) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: current.fileName, url: current.url });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(current.url);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to share');
    }
  }, [current]);

  if (!current) return null;
  const kind = kindOf(current.fileName, current.url, current.mimeType);
  const officeSubKind = kind === 'office' ? officeSubKindOf(current.fileName, current.url, current.mimeType) : null;
  const isMedia = kind === 'image' || kind === 'pdf' || kind === 'video' || kind === 'embed' || kind === 'office';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={
          !isMedia
            ? 'max-w-md'
            : 'max-w-[90vw] max-h-[90vh] w-full h-full sm:w-[90vw] sm:h-[90vh] p-0 flex flex-col overflow-hidden [&>button]:hidden'
        }
      >
        {!isMedia ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <DialogTitle className="sr-only">{current.fileName}</DialogTitle>
            <div className="w-14 h-14 rounded-xl bg-muted border border-border flex items-center justify-center">
              <FileIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground text-center break-all">{current.fileName}</p>
            <p className="text-xs text-muted-foreground">No inline preview available for this file type.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                Share
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={current.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Open in new tab
                </a>
              </Button>
              <Button size="sm" asChild>
                <a href={current.url} download={current.fileName}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
              <DialogTitle className="text-sm font-medium text-foreground truncate pr-4 flex items-center gap-2">
                {(kind === 'video' || kind === 'embed') && <Video className="w-4 h-4 shrink-0 text-muted-foreground" />}
                {current.fileName}
              </DialogTitle>
              <div className="flex items-center gap-3 shrink-0">
                {list && (
                  <span className="text-xs text-muted-foreground">
                    {currentIdx + 1} / {list.length}
                  </span>
                )}
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Share"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4" />
                </button>
                {kind !== 'embed' && (
                  <button
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Download"
                    onClick={async () => {
                      try {
                        const res = await fetch(current.url);
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = current.fileName;
                        a.click();
                        URL.revokeObjectURL(blobUrl);
                      } catch {
                        window.open(current.url, '_blank');
                      }
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                {kind === 'embed' && (
                  <a
                    href={current.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {kind === 'office' && (
                  <a
                    href={getOfficeViewerUrl(current.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {kind === 'pdf' && !pdfError && blobUrl && (
                  <>
                    <button
                      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                      title="Zoom out"
                      disabled={pdfScale <= 0.5}
                      onClick={() => setPdfScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(pdfScale * 100)}%</span>
                    <button
                      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                      title="Zoom in"
                      disabled={pdfScale >= 3}
                      onClick={() => setPdfScale(s => Math.min(3, +(s + 0.25).toFixed(2)))}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </>
                )}
                {kind === 'image' && (
                  <button
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy image to clipboard"
                    onClick={async () => {
                      try {
                        const res = await fetch(current.url);
                        const blob = await res.blob();
                        const bitmap = await createImageBitmap(blob);
                        const canvas = document.createElement('canvas');
                        canvas.width = bitmap.width;
                        canvas.height = bitmap.height;
                        canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
                        const pngBlob = await new Promise<Blob>((resolve, reject) =>
                          canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
                        );
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
                        toast.success('Image copied to clipboard');
                      } catch {
                        toast.error('Failed to copy');
                      }
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="relative flex-1 min-h-0 bg-muted/30 flex items-center justify-center overflow-auto">
              {list && (
                <button
                  onClick={goPrev}
                  className="absolute left-2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-background/80 border border-border shadow hover:bg-background transition-colors"
                  aria-label="Previous file"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {kind === 'image' ? (
                <ImageWithProgress
                  src={current.url}
                  alt={current.fileName}
                  className="max-w-full max-h-full object-contain"
                />
              ) : kind === 'video' ? (
                <video
                  src={current.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-full"
                  style={{ maxHeight: 'calc(90vh - 56px)' }}
                >
                  Your browser does not support the video tag.
                </video>
              ) : kind === 'embed' ? (
                <iframe
                  src={getEmbedUrl(current.url) ?? current.url}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  title={current.fileName}
                />
              ) : kind === 'office' && officeSubKind === 'spreadsheet' ? (
                officeLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                ) : officeError ? (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <FileIcon className="w-10 h-10" />
                    <p className="text-sm">Unable to preview this file.</p>
                    <Button variant="outline" size="sm" asChild>
                      <a href={current.url} download={current.fileName}>
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col">
                    <style>{`
                      .xlsx-preview table { border-collapse: collapse; font-size: 12px; }
                      .xlsx-preview td, .xlsx-preview th { border: 1px solid hsl(var(--border)); padding: 4px 8px; white-space: nowrap; }
                    `}</style>
                    {sheetNames.length > 1 && (
                      <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto shrink-0">
                        {sheetNames.map((name, i) => (
                          <button
                            key={name}
                            onClick={() => setActiveSheet(i)}
                            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                              i === activeSheet
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div
                      className="flex-1 overflow-auto p-3 xlsx-preview"
                      dangerouslySetInnerHTML={{ __html: activeSheetHtml }}
                    />
                  </div>
                )
              ) : kind === 'office' && officeSubKind === 'word' ? (
                <div className="relative w-full h-full overflow-auto bg-white text-black">
                  {officeLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {officeError && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white text-muted-foreground">
                      <FileIcon className="w-10 h-10" />
                      <p className="text-sm">Unable to preview this file.</p>
                    </div>
                  )}
                  <div ref={wordContainerRef} className="p-4" />
                </div>
              ) : kind === 'office' && officeSubKind === 'slideshow' ? (
                <div className="relative w-full h-full overflow-auto bg-muted/30 flex justify-center">
                  {officeLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {officeError && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
                      <FileIcon className="w-10 h-10" />
                      <p className="text-sm">Unable to preview this file.</p>
                    </div>
                  )}
                  <div ref={pptxContainerRef} className="py-4" />
                </div>
              ) : kind === 'office' ? (
                <iframe
                  src={getOfficeViewerUrl(current.url)}
                  className="w-full h-full border-0"
                  title={current.fileName}
                />
              ) : blobLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              ) : blobUrl ? (
                pdfError ? (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <FileIcon className="w-10 h-10" />
                    <p className="text-sm">Unable to preview this PDF.</p>
                    <Button variant="outline" size="sm" asChild>
                      <a href={current.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Open in new tab
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div ref={pdfContainerRef} className="w-full h-full overflow-auto flex justify-center">
                    <Document
                      file={blobUrl}
                      onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                      onLoadError={(err) => {
                        logger.error('pdf.js failed to render document:', err);
                        setPdfError(true);
                      }}
                      loading={<Loader2 className="w-8 h-8 animate-spin text-muted-foreground mt-8" />}
                      className="flex flex-col items-center gap-4 py-4"
                    >
                      {Array.from({ length: numPages }, (_, i) => (
                        <Page
                          key={i}
                          pageNumber={i + 1}
                          width={Math.min(pdfContainerWidth - 32, 900) * pdfScale}
                          className="shadow-md"
                        />
                      ))}
                    </Document>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <FileIcon className="w-10 h-10" />
                  <p className="text-sm">Unable to preview this file.</p>
                  {blobError && (
                    <p className="max-w-md text-center text-xs text-muted-foreground/80 break-all">
                      {blobError}
                    </p>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <a href={current.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Open in new tab
                    </a>
                  </Button>
                </div>
              )}
              {list && (
                <button
                  onClick={goNext}
                  className="absolute right-2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-background/80 border border-border shadow hover:bg-background transition-colors"
                  aria-label="Next file"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
