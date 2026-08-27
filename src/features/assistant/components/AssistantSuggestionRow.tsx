import type { AssistantSuggestion } from '../assistantData';

interface AssistantSuggestionRowProps {
  suggestion: AssistantSuggestion;
  onSelect: (text: string) => void;
}

/** Compact ChatGPT-style suggestion chip — a pill, not a full-width row. */
export function AssistantSuggestionRow({ suggestion, onSelect }: AssistantSuggestionRowProps) {
  const Icon = suggestion.icon;
  return (
    <button
      type="button"
      title={suggestion.text}
      onClick={() => onSelect(suggestion.text)}
      className="flex max-w-full items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-left transition-colors hover:bg-accent"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-xs text-foreground">{suggestion.text}</span>
    </button>
  );
}
