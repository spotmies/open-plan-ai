import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { ChevronDown, MoreVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MobileKanbanColumnProps {
  label: string;
  count: number;
  countLabel?: string;
  dot?: ReactNode;
  labelClassName?: string;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  isDragging?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Mobile Kanban column: a vertically-stacked, collapsible summary card with a
 * drag handle (the top-right dots) for reordering categories. Desktop keeps
 * the horizontal-scroll column layout untouched.
 */
export function MobileKanbanColumn({
  label,
  count,
  countLabel = 'items',
  dot,
  labelClassName,
  dragHandleProps,
  isDragging,
  defaultExpanded = false,
  className,
  children,
}: MobileKanbanColumnProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card
      className={cn(
        'w-full overflow-hidden transition-shadow',
        isDragging && 'shadow-lg ring-1 ring-primary/30',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 p-3">
        <button
          type="button"
          className="min-w-0 flex-1 space-y-1 text-left"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-2 min-w-0">
            {dot}
            <h3 title={label} className={cn('font-medium text-sm truncate', labelClassName)}>
              {label}
            </h3>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform',
                isExpanded && 'rotate-180'
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {count} {countLabel}
          </p>
        </button>

        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="shrink-0 -mt-1 -mr-1 p-2 rounded-md cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted touch-none"
            aria-label={`Drag to reposition ${label}`}
          >
            <MoreVertical className="h-4 w-4" />
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 max-h-[60vh] overflow-y-auto">
          {children}
        </div>
      )}
    </Card>
  );
}
