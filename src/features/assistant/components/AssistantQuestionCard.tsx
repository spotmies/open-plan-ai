import { useState } from 'react';
import { Check, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AskUserQuestion } from '../assistantData';

interface AssistantQuestionCardProps {
  questions: AskUserQuestion[];
  onSubmit: (answers: Array<{ header: string; selected: string[] }>) => void;
  disabled?: boolean;
}

/**
 * Renders every question from one ask_user call (in practice almost always
 * one), each with its 2-4 options — single-select or multiSelect — plus a
 * free-text "Other" input that's always available alongside the model's
 * options (PHASE_1_ASK_READONLY.md §5.3). One Submit answers all of them.
 */
export function AssistantQuestionCard({ questions, onSubmit, disabled }: AssistantQuestionCardProps) {
  const [selections, setSelections] = useState<Record<number, Set<string>>>({});
  const [otherTexts, setOtherTexts] = useState<Record<number, string>>({});

  const toggleOption = (qIndex: number, label: string, multiSelect: boolean) => {
    setSelections((prev) => {
      const current = prev[qIndex] ?? new Set<string>();
      const next = new Set(multiSelect ? current : []);
      if (multiSelect && current.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return { ...prev, [qIndex]: next };
    });
  };

  const valuesFor = (qIndex: number): string[] => {
    const vals = Array.from(selections[qIndex] ?? []);
    const other = otherTexts[qIndex]?.trim();
    if (other) vals.push(other);
    return vals;
  };

  const canSubmit = questions.every((_, i) => valuesFor(i).length > 0);

  const handleSubmit = () => {
    onSubmit(questions.map((q, i) => ({ header: q.header, selected: valuesFor(i) })));
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
        <HelpCircle className="h-3.5 w-3.5" />
        Needs your input
      </div>

      <div className="space-y-5">
        {questions.map((question, qIndex) => (
          <div key={question.header} className="space-y-2.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{question.header}</p>
              <p className="mt-0.5 text-sm text-foreground">{question.question}</p>
            </div>

            <div className="space-y-1.5">
              {question.options.map((option) => {
                const isSelected = selections[qIndex]?.has(option.label) ?? false;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => toggleOption(qIndex, option.label, question.multiSelect)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50',
                    )}
                  >
                    {question.multiSelect ? (
                      <Checkbox checked={isSelected} className="pointer-events-none mt-0.5" />
                    ) : (
                      <div
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                          isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground',
                        )}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <Input
              value={otherTexts[qIndex] ?? ''}
              onChange={(e) => setOtherTexts((prev) => ({ ...prev, [qIndex]: e.target.value }))}
              placeholder="Other — type your own answer"
              className="h-8 text-xs"
            />
          </div>
        ))}
      </div>

      <Button size="sm" className="mt-4" disabled={!canSubmit || disabled} onClick={handleSubmit}>
        Submit
      </Button>
    </div>
  );
}
