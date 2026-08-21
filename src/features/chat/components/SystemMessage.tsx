interface SystemMessageProps {
  content: string;
}

/** Generated notices ("X joined the group", "X was removed") render as a
 *  centered chip rather than a chat bubble — WhatsApp-style — so they read as
 *  events in the timeline instead of something a person said. */
export function SystemMessage({ content }: SystemMessageProps) {
  return (
    <div className="flex justify-center py-2 px-4">
      <span className="max-w-[80%] rounded-full bg-muted/70 px-3 py-1 text-center text-xs text-muted-foreground">
        {content}
      </span>
    </div>
  );
}
