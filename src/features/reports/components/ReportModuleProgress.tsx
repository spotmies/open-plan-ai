import { memo, useMemo } from 'react';
import { Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ModuleProgressItem } from '../utils/reportsUtils';

interface ReportModuleProgressProps {
  data: ModuleProgressItem[];
}

export const ReportModuleProgress = memo(function ReportModuleProgress({ data = [] }: ReportModuleProgressProps) {
  const sortedData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    return [...safeData].sort((a, b) => b.progress - a.progress);
  }, [data]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Module Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            No module data to display
          </div>
        ) : (
          <div className="space-y-4">
            {sortedData.map((item) => (
              <div
                key={item.module.id}
                className="p-2 -mx-2 rounded-lg"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.module.color || 'hsl(var(--primary))' }}
                    />
                    <span className="text-sm font-medium">{item.module.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.completedTasks}/{item.totalTasks} ({item.progress}%)
                  </span>
                </div>
                <Progress
                  value={item.progress}
                  className="h-2"
                  style={{
                    '--progress-color': item.module.color || 'hsl(var(--primary))'
                  } as React.CSSProperties}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
