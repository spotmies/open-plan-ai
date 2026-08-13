interface HighlightedTextProps {
  text: string;
  query?: string;
}

/** Wraps substrings of `text` matching `query` in a <mark>, Teams/WhatsApp-style search highlighting. */
export function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query?.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-300/60 dark:bg-yellow-500/40 rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
