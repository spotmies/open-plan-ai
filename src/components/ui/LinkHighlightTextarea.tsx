import * as React from 'react';

import { cn } from '@/lib/utils';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * Every property that affects how text wraps has to be identical on the
 * textarea and on the highlight layer behind it, or the blue runs drift off the
 * URLs they belong to. Keep additions to this string in sync with both.
 */
const BOX = 'min-h-[80px] w-full rounded-md border px-3 py-2 text-sm [scrollbar-gutter:stable]';

/**
 * A drop-in `Textarea` that paints URLs blue as they're typed or pasted.
 *
 * A textarea can only hold plain text, so the colour comes from a mirrored
 * layer rendered underneath it: the textarea's own text is transparent (only
 * its caret and selection show), and the layer behind draws the same string
 * with the URLs coloured. The two are kept in lockstep by sharing `BOX` and by
 * syncing scroll position.
 */
export const LinkHighlightTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, value, onScroll, ...props }, ref) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement, []);

  const text = typeof value === 'string' ? value : '';

  const syncScroll = React.useCallback(() => {
    const el = textareaRef.current;
    const overlay = overlayRef.current;
    if (!el || !overlay) return;
    overlay.scrollTop = el.scrollTop;
    overlay.scrollLeft = el.scrollLeft;
  }, []);

  React.useLayoutEffect(syncScroll, [text, syncScroll]);

  // split() with a single-capture-group regex interleaves [text, url, text, ...],
  // so odd indices are always the captured URLs.
  const segments = React.useMemo(() => text.split(URL_REGEX), [text]);

  return (
    <div className="relative w-full">
      <div
        ref={overlayRef}
        aria-hidden="true"
        className={cn(
          BOX,
          'absolute inset-0 overflow-hidden whitespace-pre-wrap break-words border-transparent bg-background text-foreground pointer-events-none',
          props.disabled && 'opacity-50',
          className,
        )}
      >
        {segments.map((segment, i) =>
          i % 2 === 1 ? (
            <span key={i} className="text-blue-600 dark:text-blue-400">
              {segment}
            </span>
          ) : (
            <React.Fragment key={i}>{segment}</React.Fragment>
          ),
        )}
        {/* A trailing newline would otherwise collapse, dropping the last line. */}
        {'\n'}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onScroll={(e) => {
          syncScroll();
          onScroll?.(e);
        }}
        className={cn(
          BOX,
          'relative flex overflow-y-auto border-input bg-transparent text-transparent caret-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  );
});
LinkHighlightTextarea.displayName = 'LinkHighlightTextarea';
