import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface AssistantMarkdownProps {
  content: string;
  className?: string;
}

// Chat-bubble-tuned renderer — deliberately not the @tailwindcss/typography
// "prose" plugin (its blog-post spacing/max-width don't fit a compact
// bubble). Every block resets its own top margin via first:mt-0 rather than
// relying on space-y-* on the wrapper, so partial/streaming markdown (e.g.
// a list cut off mid-item) never leaves a dangling gap.
const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5 marker:text-muted-foreground">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  code: ({ children, ...props }) => (
    <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]" {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-foreground/5 p-3 font-mono text-xs leading-relaxed last:mb-0 [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-border pl-3 italic text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => <h4 className="mb-1 mt-3 text-base font-semibold first:mt-0">{children}</h4>,
  h2: ({ children }) => <h4 className="mb-1 mt-3 text-base font-semibold first:mt-0">{children}</h4>,
  h3: ({ children }) => <h4 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h4>,
  hr: () => <hr className="my-2 border-border" />,
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
};

export function AssistantMarkdown({ content, className }: AssistantMarkdownProps) {
  return (
    <div className={cn('min-w-0 text-sm leading-relaxed', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
