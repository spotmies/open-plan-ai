import { useState } from 'react';
import { ChevronRight, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AskUserRecap } from '../assistantData';

interface AssistantQuestionRecapProps {
  recap: AskUserRecap[];
}

/**
 * Collapsed-by-default record of a clarifying question the assistant asked
 * mid-turn and the answer the user gave — the same treatment Claude Code
 * gives a resolved tool call, applied to ask_user. Read-only: the question
 * is already resolved, this is just the transcript remembering it happened.
 */
export function AssistantQuestionRecap({ recap }: AssistantQuestionRecapProps) {
  const [open, setOpen] = useState(false);
  const summary = recap.length === 1 ? recap[0].question.header : `${recap.length} questions answered`;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className="flex items-center gap-1.5 rounded-md py-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Answered: {summary}</span>
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          {recap.map(({ question, answer }) => (
            <div key={question.header} className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {question.header}
              </p>
              <p className="text-sm text-foreground">{question.question}</p>
              <p className="text-sm font-medium text-primary">→ {answer}</p>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
