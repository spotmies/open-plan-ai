import { memo, useMemo, useCallback, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  StatusBreakdown,
  IssueStatusBreakdown,
  getStatusLabel,
  getStatusColor,
  getIssueStatusLabel,
  getIssueStatusColor,
} from '../utils/reportsUtils';

type BreakdownView = 'tasks' | 'issues';

interface ReportTaskStatusChartProps {
  data: StatusBreakdown[];
  issueData: IssueStatusBreakdown[];
  onStatusClick?: (status: string) => void;
  onIssueStatusClick?: (status: string) => void;
}

export const ReportTaskStatusChart = memo(function ReportTaskStatusChart({
  data,
  issueData,
  onStatusClick,
  onIssueStatusClick,
}: ReportTaskStatusChartProps) {
  const [view, setView] = useState<BreakdownView>('tasks');
  const isTaskView = view === 'tasks';

  const chartData = useMemo(() => {
    if (isTaskView) {
      return data.map(item => ({
        name: getStatusLabel(item.status),
        value: item.count,
        count: item.count,
        status: item.status,
        percentage: item.percentage,
        color: getStatusColor(item.status),
      }));
    }
    return issueData.map(item => ({
      name: getIssueStatusLabel(item.status),
      value: item.count,
      count: item.count,
      status: item.status,
      percentage: item.percentage,
      color: getIssueStatusColor(item.status),
    }));
  }, [isTaskView, data, issueData]);

  const totalItems = useMemo(
    () => chartData.reduce((sum, item) => sum + item.count, 0),
    [chartData]
  );

  const handlePieClick = useCallback((pieData: { status: string }) => {
    if (isTaskView) onStatusClick?.(pieData.status);
    else onIssueStatusClick?.(pieData.status);
  }, [isTaskView, onStatusClick, onIssueStatusClick]);

  const handleLegendClick = useCallback((status: string) => {
    if (isTaskView) onStatusClick?.(status);
    else onIssueStatusClick?.(status);
  }, [isTaskView, onStatusClick, onIssueStatusClick]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-medium">Status Breakdown</CardTitle>
        <Select value={view} onValueChange={(value) => setView(value as BreakdownView)}>
          <SelectTrigger className="w-[110px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tasks">Task</SelectItem>
            <SelectItem value="issues">Issues</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {totalItems === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            {isTaskView ? 'No tasks to display' : 'No issues to display'}
          </div>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  onClick={handlePieClick}
                  className="cursor-pointer"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg px-3 py-2 shadow-lg">
                          <p className="font-medium text-sm">{data.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {data.value} {isTaskView ? 'tasks' : 'issues'} ({data.percentage}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  content={({ payload }) => (
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                      {payload?.map((entry, index) => (
                        <button
                          key={`legend-${index}`}
                          className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity"
                          onClick={() => handleLegendClick(chartData[index].status)}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-muted-foreground">
                            {entry.value}: {chartData[index].count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
