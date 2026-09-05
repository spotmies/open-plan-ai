import { formatDistanceToNow } from 'date-fns';
import { Activity as ActivityIcon } from 'lucide-react';
import { Activity } from '@/types';
import { cn } from '@/lib/utils';
import {
  activityIcons,
  activityColors,
  activityLabels,
  activityActionText,
  avatarColorFor,
} from './activityMeta';

interface ActivityRowProps {
  activity: Activity;
  isMobile: boolean;
  isClickable: boolean;
  onClick: () => void;
}

export function ActivityRow({ activity, isMobile, isClickable, onClick }: ActivityRowProps) {
  const Icon = activityIcons[activity.type] || ActivityIcon;
  const colorClass = activityColors[activity.type] || 'text-muted-foreground bg-muted';
  const label = activityLabels[activity.type] || 'Unknown Activity';
  const actionText = activityActionText[activity.type] || label.toLowerCase();
  const initials = activity.user.initials || activity.user.name.slice(0, 2).toUpperCase();

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0 transition-colors px-2 rounded-md',
        isClickable && 'hover:bg-muted/30 cursor-pointer',
        !isMobile && '-mx-2'
      )}
    >
      {/* Left: avatar (mobile) or subtle status icon (desktop) */}
      {isMobile ? (
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-semibold text-white',
          avatarColorFor(activity.user.id || activity.user.name)
        )}>
          {initials}
        </div>
      ) : (
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
          colorClass
        )}>
          <Icon className="h-4 w-4" />
        </div>
      )}

      {/* Center: Content */}
      <div className="flex-1 min-w-0">
        {/* Primary: Actor name (bold) + action text */}
        <p className="text-sm leading-snug flex items-baseline gap-1 min-w-0">
          <span className="font-semibold truncate max-w-[45%] shrink-0" title={activity.user.name}>{activity.user.name}</span>
          <span className="text-muted-foreground text-foreground/80 break-words line-clamp-2 min-w-0">{isMobile ? actionText : activity.description}</span>
        </p>

        {/* Mobile: quoted description as a secondary line */}
        {isMobile && activity.description && (
          <p className="text-xs text-muted-foreground/90 italic mt-1 line-clamp-2">
            &ldquo;{activity.description}&rdquo;
          </p>
        )}

        {/* Secondary: Project name, Type badge & Timestamp row */}
        <div className={cn('mt-1.5 gap-2', isMobile ? 'flex flex-col items-start' : 'flex items-center justify-between')}>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {activity.projectName && (
              <p className="text-xs text-muted-foreground truncate min-w-0 max-w-[150px] sm:max-w-full">
                in{' '}
                <span className={cn('font-medium', isClickable ? 'text-primary hover:underline cursor-pointer' : 'text-foreground/80')}>
                  {activity.projectName}
                </span>
              </p>
            )}
            <span className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
              colorClass
            )}>
              {label}
            </span>
          </div>

          <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}
