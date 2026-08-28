import { Progress } from '@/components/ui/progress';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Boxes, Flag, ListTodo, AlertTriangle, ChevronDown } from 'lucide-react';
import { ProgressBreakdown } from '../utils/projectUtils';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// Match colors from reportsUtils or global CSS
function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    'todo': 'hsl(var(--status-todo))',
    'in-progress': 'hsl(var(--status-in-progress))',
    'review': 'hsl(var(--status-review))',
    'done': 'hsl(var(--status-done))',
    'blocked': 'hsl(var(--status-blocked))',
    'others': 'hsl(var(--muted-foreground))'
  };
  return colors[status] || 'hsl(var(--muted))';
}

interface ProjectProgressPopoverProps {
  breakdown: ProgressBreakdown;
}

export function ProjectProgressPopover({ breakdown }: ProjectProgressPopoverProps) {
  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-2 cursor-help">
          <Progress value={breakdown.overallProgress} className="w-24 h-2" />
          <span className="text-sm font-medium">{breakdown.overallProgress}%</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-64 z-50"
        align="start"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          // Stop pointer down events from bubbling to draggable/clickable parents
          e.stopPropagation();
        }}
      >
        <ProjectProgressBreakdown breakdown={breakdown} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function ProjectProgressBreakdown({ breakdown }: { breakdown: ProgressBreakdown }) {
  const [isTasksOpen, setIsTasksOpen] = useState(false);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Progress Breakdown</h4>

      {/* Modules */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Boxes className="h-3 w-3" />
            Modules
          </span>
          <span className="font-medium">{breakdown.moduleProgress}%</span>
        </div>
        <Progress value={breakdown.moduleProgress} className="h-1.5" />
      </div>

      {/* Milestones */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Flag className="h-3 w-3" />
            Milestones
          </span>
          <span className="font-medium">{breakdown.milestoneProgress}%</span>
        </div>
        <Progress value={breakdown.milestoneProgress} className="h-1.5" />
      </div>

      {/* Tasks */}
      <Collapsible
        open={isTasksOpen}
        onOpenChange={setIsTasksOpen}
        className="space-y-1"
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between text-xs cursor-pointer hover:bg-muted/50 p-1 -mx-1 rounded transition-colors group">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ListTodo className="h-3 w-3" />
              Tasks
              <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", isTasksOpen && "rotate-180")} />
            </span>
            <span className="font-medium">{breakdown.taskProgress}%</span>
          </div>
        </CollapsibleTrigger>

        {/* Multi-colored task progress bar */}
        {breakdown.taskStats && breakdown.taskStats.total > 0 ? (
          <div className="h-1.5 w-full flex rounded-full overflow-hidden bg-secondary">
            {Object.entries({
              'todo': breakdown.taskStats.todo,
              'in-progress': breakdown.taskStats.inProgress,
              'review': breakdown.taskStats.review,
              'done': breakdown.taskStats.done,
              'blocked': breakdown.taskStats.blocked,
              'others': breakdown.taskStats.others
            }).map(([status, count]) => {
              if (count === 0) return null;
              const percentage = (count / breakdown.taskStats!.total) * 100;
              return (
                <div
                  key={status}
                  style={{ width: `${percentage}%`, backgroundColor: getStatusColor(status) }}
                  className="h-full transition-all"
                  title={`${status}: ${count}`}
                />
              );
            })}
          </div>
        ) : (
          <Progress value={breakdown.taskProgress} className="h-1.5" />
        )}

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down pt-2 pb-1">
          {breakdown.taskStats ? (
            <div className="space-y-1.5 text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-md border text-left">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--status-todo))' }} />
                  To Do
                </span>
                <span className="font-medium">{breakdown.taskStats.todo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--status-in-progress))' }} />
                  In Progress
                </span>
                <span className="font-medium">{breakdown.taskStats.inProgress}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--status-review))' }} />
                  Review
                </span>
                <span className="font-medium">{breakdown.taskStats.review}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--status-done))' }} />
                  Done
                </span>
                <span className="font-medium">{breakdown.taskStats.done}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--status-blocked))' }} />
                  Blocked/Dependencies
                </span>
                <span className="font-medium">{breakdown.taskStats.blocked}</span>
              </div>
              {breakdown.taskStats.others > 0 && (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--muted-foreground))' }} />
                    Others
                  </span>
                  <span className="font-medium">{breakdown.taskStats.others}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground mt-2">No task data</div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Issues */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Issues Resolved
          </span>
          <span className="font-medium">{breakdown.issueProgress}%</span>
        </div>
        <Progress value={breakdown.issueProgress} className="h-1.5" />
      </div>
    </div>
  );
}

