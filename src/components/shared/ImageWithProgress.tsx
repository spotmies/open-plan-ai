import { useEffect, useRef, useState } from 'react';
import { Loader2, ImageOff } from 'lucide-react';

function isSameOrigin(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

type Phase = 'downloading' | 'decoding' | 'ready' | 'error';

/**
 * Renders an image only once it has fully downloaded, showing a determinate
 * progress ring while it streams in.
 *
 * A plain <img src> paints partial scanlines on slow connections (the image
 * appears to "fill in" top-to-bottom, or as a blurry progressive pass), which
 * reads as a broken render rather than as loading. Streaming the bytes
 * ourselves lets us report real progress and swap in the finished image in one
 * step.
 *
 * If the streaming fetch can't be used (CORS, opaque response, network error)
 * we fall back to a direct <img src> that stays hidden behind an indeterminate
 * spinner until its own load event fires — still no half-painted image.
 */
export function ImageWithProgress({
  src,
  alt,
  className,
  containerClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('downloading');
  // null = total size unknown (no Content-Length), so show an indeterminate spinner.
  const [progress, setProgress] = useState<number | null>(0);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setPhase('downloading');
    setProgress(0);
    setObjectUrl(null);
    setFallbackSrc(null);

    const publish = (blob: Blob) => {
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = url;
      setProgress(1);
      setPhase('decoding');
      setObjectUrl(url);
    };

    (async () => {
      try {
        const res = await fetch(src, {
          // Cross-origin CDNs typically answer with `Access-Control-Allow-Origin: *`,
          // which the browser rejects for credentialed requests — only send cookies
          // to our own origin, and let the <img> fallback cover hosts with no CORS.
          credentials: isSameOrigin(src) ? 'include' : 'omit',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to load image: ${res.status}`);

        const total = Number(res.headers.get('Content-Length')) || 0;
        if (!total) setProgress(null);

        // Older browsers / opaque responses expose no readable stream — take the
        // whole blob at once and keep the spinner indeterminate.
        if (!res.body?.getReader) {
          setProgress(null);
          publish(await res.blob());
          return;
        }

        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (cancelled) {
            reader.cancel().catch(() => {});
            return;
          }
          chunks.push(value);
          received += value.length;
          // Hold at 99% until the decode finishes so 100% means "visible".
          if (total) setProgress(Math.min(0.99, received / total));
        }

        publish(new Blob(chunks as BlobPart[], { type: res.headers.get('Content-Type') ?? undefined }));
      } catch (err) {
        if (cancelled || (err as Error)?.name === 'AbortError') return;
        // Let the browser try directly — it may succeed where fetch was blocked.
        setProgress(null);
        setFallbackSrc(src);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [src]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const resolvedSrc = objectUrl ?? fallbackSrc;
  const pct = progress === null ? null : Math.round(progress * 100);

  return (
    <div className={containerClassName ?? 'relative flex items-center justify-center w-full h-full'}>
      {resolvedSrc && (
        <img
          src={resolvedSrc}
          alt={alt}
          className={`${className ?? ''} ${phase === 'ready' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
          onLoad={() => setPhase('ready')}
          onError={() => setPhase('error')}
        />
      )}

      {phase === 'error' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageOff className="w-10 h-10" />
          <p className="text-sm">Unable to load this image.</p>
        </div>
      ) : phase !== 'ready' ? (
        <>
          <LoadingBar pct={pct} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * YouTube-style bar pinned to the top of the frame: it advances with the real
 * download when the size is known, and sweeps indefinitely when it isn't.
 */
function LoadingBar({ pct }: { pct: number | null }) {
  return (
    <div
      className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden bg-muted-foreground/10 z-10"
      role="progressbar"
      aria-valuenow={pct ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {pct === null ? (
        <div className="h-full w-1/4 bg-primary/60 animate-progress-sweep" />
      ) : (
        <div
          className="h-full bg-primary/60 transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}
