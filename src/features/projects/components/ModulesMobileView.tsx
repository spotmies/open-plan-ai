import { Module, Task } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ListTodo } from 'lucide-react';
import { formatModuleType, getModuleColor } from '../utils/projectUtils';
import { resolveFileUrl } from '@/utils/fileUrl';

interface ModuleWithStats extends Module {
  taskCount: number;
  progress: number;
  openIssues: number;
  tasks: Task[];
}

interface ModulesMobileViewProps {
  modules: ModuleWithStats[];
  onModuleClick?: (module: ModuleWithStats) => void;
}

export function ModulesMobileView({ modules, onModuleClick }: ModulesMobileViewProps) {
  if (modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <ListTodo className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-1">No modules yet</h3>
        <p className="text-sm text-muted-foreground">
          Add modules to organize your project by functional areas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {modules.map((module) => {
        const moduleColor = getModuleColor(module.type);
        const progress = Math.min(100, Math.max(0, module.progress));

        return (
          <button
            key={module.id}
            type="button"
            onClick={() => onModuleClick?.(module)}
            className="w-full text-left rounded-2xl border bg-card p-4 active:bg-muted/50 transition-colors"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: moduleColor }}
                />
                <h3 className="font-semibold text-[15px] truncate">{module.name}</h3>
              </div>
              <span
                className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: `${moduleColor}1A`, color: moduleColor }}
              >
                {formatModuleType(module.type)}
              </span>
            </div>

            {/* Owner */}
            <div className="flex items-center gap-2 mb-3">
              {module.owner ? (
                <>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={resolveFileUrl(module.owner.avatar) ?? module.owner.avatar} alt={module.owner.name} />
                    <AvatarFallback className="text-[10px] bg-muted">
                      {module.owner.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-foreground">{module.owner.name}</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </div>

            {/* Task count */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
              <ListTodo className="h-4 w-4" />
              <span>{module.taskCount} tasks</span>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, backgroundColor: moduleColor }}
                />
              </div>
              <span className="text-sm font-semibold text-foreground shrink-0">
                {Math.round(progress)}%
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
