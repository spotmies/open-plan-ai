import { ArrowUpRight } from 'lucide-react';
import type { AssistantSuggestion } from '../assistantData';

interface AssistantSuggestionRowProps {
  suggestion: AssistantSuggestion;
  onSelect: (text: string) => void;
}

export function AssistantSuggestionRow({ suggestion, onSelect }: AssistantSuggestionRowProps) {
  const Icon = suggestion.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion.text)}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-left transition-colors hover:bg-accent"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{suggestion.text}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}
