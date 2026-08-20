import { useState } from 'react';
import { ChevronDown, ChevronRight, Star, PenLine, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';

export type QuickView = 'favourites' | 'drafts' | 'saved';

interface QuickViewsProps {
  activeQuickView: QuickView | null;
  onSelect: (view: QuickView) => void;
}

const ITEMS: { id: QuickView; label: string; icon: typeof Star }[] = [
  { id: 'favourites', label: 'Favorites', icon: Star },
  { id: 'drafts', label: 'Drafts', icon: PenLine },
  { id: 'saved', label: 'Saved', icon: Bookmark },
];

/** Teams-style "Quick views" list: a collapsible group of shortcuts (Favorites,
 *  Drafts, Saved) sitting between the search box and the All/DMs/Groups tabs. */
export function QuickViews({ activeQuickView, onSelect }: QuickViewsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-2 pb-1">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground rounded-md transition-colors"
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Quick views
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5">
          {ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-1.5 rounded-md text-sm text-left hover:bg-muted transition-colors',
                activeQuickView === id && 'bg-muted font-medium'
              )}
            >
              <Icon className={cn('h-4 w-4 text-muted-foreground', activeQuickView === id && 'text-amber-500 fill-amber-500/20')} />
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-1 border-t border-border" />
    </div>
  );
}
