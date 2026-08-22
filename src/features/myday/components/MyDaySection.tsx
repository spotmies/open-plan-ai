import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MyDayTaskCard } from './MyDayTaskCard';
import { MyDayTask } from '../utils/myDayUtils';
import { TaskStatus } from '@/types';

interface MyDaySectionProps {
  title: string;
  description: string;
  icon: LucideIcon;
  variant: 'attention' | 'ready' | 'blocked';
  tasks: MyDayTask[];
  onTaskClick: (task: MyDayTask) => void;
  onStatusUpdate: (taskId: string, status: TaskStatus) => void;
  onChecklistToggle: (taskId: string, itemId: string) => void;
}

export function MyDaySection({
  title,
  description,
  icon: Icon,
  variant,
  tasks,
  onTaskClick,
  onStatusUpdate,
  onChecklistToggle,
}: MyDaySectionProps) {
  const variantStyles = {
    attention: {
      header: 'text-destructive',
      icon: 'bg-destructive/10 text-destructive',
      border: 'border-l-destructive',
    },
    ready: {
      header: 'text-status-done',
      icon: 'bg-status-done/10 text-status-done',
      border: 'border-l-status-done',
    },
    blocked: {
      header: 'text-muted-foreground',
      icon: 'bg-muted text-muted-foreground',
      border: 'border-l-muted',
    },
  };

  const styles = variantStyles[variant];

  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('p-2 rounded-lg', styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className={cn('font-semibold text-base', styles.header)}>
            {title}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({tasks.length})
            </span>
          </h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Task Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tasks.map((task) => (
          <MyDayTaskCard
            key={task.id}
            task={task}
            variant={variant}
            onTaskClick={onTaskClick}
            onStatusUpdate={onStatusUpdate}
            onChecklistToggle={onChecklistToggle}
          />
        ))}
      </div>
    </section>
  );
}
