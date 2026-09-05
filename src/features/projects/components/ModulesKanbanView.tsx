import { Module, Task } from '@/types';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertTriangle, CheckCircle2, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatModuleType, getModuleColor } from '../utils/projectUtils';
import { resolveFileUrl } from '@/utils/fileUrl';

interface ModuleWithStats extends Module {
  taskCount: number;
  progress: number;
  openIssues: number;
  tasks: Task[];
}

interface ModulesKanbanViewProps {
  modules: ModuleWithStats[];
  onModuleClick?: (module: ModuleWithStats) => void;
}

export function ModulesKanbanView({ modules, onModuleClick }: ModulesKanbanViewProps) {
  if (modules.length === 0) {
    return (
      <div className="rounded-lg border bg-card min-h-[calc(100vh-260px)] flex flex-col items-center justify-center p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <ListTodo className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-1 text-base">No modules yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Add modules to organize your project by functional areas
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {modules.map((module) => {
        const moduleColor = getModuleColor(module.type);
        const isComplete = module.progress === 100;
        const hasIssues = module.openIssues > 0;

        return (
          <Card
            key={module.id}
            className={cn(
              'p-4 cursor-pointer hover:shadow-md transition-all border-l-4 group'
            )}
            style={{ borderLeftColor: moduleColor }}
            onClick={() => onModuleClick?.(module)}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: moduleColor }}
                />
                <h3 className="font-medium text-sm leading-tight truncate">{module.name}</h3>
              </div>
              {isComplete ? (
                <CheckCircle2 className="h-4 w-4 text-status-done shrink-0" />
              ) : hasIssues ? (
                <AlertTriangle className="h-4 w-4 text-status-blocked shrink-0" />
              ) : null}
            </div>

            {/* Description */}
            {module.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                {module.description}
              </p>
            )}

            {/* Stats */}
            <div className="space-y-3">
              {/* Task count */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{module.taskCount} tasks</span>
                <Badge variant="secondary" className="text-[10px]">
                  {formatModuleType(module.type)}
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{Math.round(module.progress)}%</span>
                </div>
                <Progress value={module.progress} className="h-1.5" />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t">
                {module.owner ? (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={resolveFileUrl(module.owner.avatar) ?? module.owner.avatar} alt={module.owner.name} />
                      <AvatarFallback className="text-[9px] bg-muted">
                        {module.owner.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">{module.owner.name}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">No owner</span>
                )}

                {hasIssues && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {module.openIssues}
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
