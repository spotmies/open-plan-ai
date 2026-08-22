import { CheckSquare, AlertCircle, Flag, Cpu, Layers, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatEntityType, EntityTagRef } from '../types';

const ENTITY_ICON: Record<ChatEntityType, typeof CheckSquare> = {
  task: CheckSquare,
  issue: AlertCircle,
  milestone: Flag,
  hardware_module: Cpu,
  bom_node: Layers,
  eco: FileText,
};

const ENTITY_LABEL: Record<ChatEntityType, string> = {
  task: 'Task',
  issue: 'Issue',
  milestone: 'Milestone',
  hardware_module: 'Module',
  bom_node: 'BOM',
  eco: 'ECO',
};

interface EntityTagChipProps {
  tag: EntityTagRef;
  variant: 'pending' | 'sent';
  isOwn?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
}

export default function EntityTagChip({ tag, variant, isOwn = false, onRemove, onClick }: EntityTagChipProps) {
  const Icon = ENTITY_ICON[tag.entityType];

  return (
    <div
      className={cn(
        'group relative inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs max-w-full',
        isOwn
          ? 'border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground'
          : 'border-border bg-muted text-foreground',
        variant === 'sent' && (isOwn ? 'cursor-pointer hover:bg-primary-foreground/20' : 'cursor-pointer hover:bg-muted/70 hover:border-primary/40 transition-colors')
      )}
      onClick={variant === 'sent' ? onClick : undefined}
      role={variant === 'sent' ? 'button' : undefined}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground')} />
      <span
        className={cn(
          'text-[9px] font-bold uppercase rounded px-1 py-0.5 leading-none shrink-0',
          isOwn ? 'text-primary-foreground bg-primary-foreground/20' : 'text-primary bg-primary/10'
        )}
      >
        {ENTITY_LABEL[tag.entityType]}
      </span>
      <span className="truncate font-medium">{tag.label}</span>
      {variant === 'pending' && onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 h-4 w-4 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-white transition-colors"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
