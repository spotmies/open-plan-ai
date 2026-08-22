import { useState, useMemo, useCallback, memo } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveFileUrl } from '@/utils/fileUrl';
import { Issue, IssueSeverity } from '@/types';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface ReportOpenIssuesTableProps {
  issues: Issue[];
  onIssueClick?: (issueId: string) => void;
}

type SortField = 'severity' | 'title' | 'blocking' | 'reportedAt';
type SortDirection = 'asc' | 'desc';

const severityConfig: Record<IssueSeverity, { 
  icon: typeof AlertCircle; 
  color: string; 
  order: number 
}> = {
  critical: { icon: AlertCircle, color: 'text-destructive', order: 0 },
  major: { icon: AlertTriangle, color: 'text-amber-600', order: 1 },
  minor: { icon: Info, color: 'text-blue-500', order: 2 },
  trivial: { icon: Info, color: 'text-muted-foreground', order: 3 },
};

export const ReportOpenIssuesTable = memo(function ReportOpenIssuesTable({ issues, onIssueClick }: ReportOpenIssuesTableProps) {
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const openIssues = useMemo(() => issues.filter(i =>
    i.status !== 'resolved' && i.status !== 'wont-fix'
  ), [issues]);
  
  const sortedIssues = useMemo(() => [...openIssues].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'severity':
        comparison = severityConfig[a.severity].order - severityConfig[b.severity].order;
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'blocking':
        const aBlocking = (a.blocksTaskIds?.length || 0) + (a.blocksMilestoneIds?.length || 0);
        const bBlocking = (b.blocksTaskIds?.length || 0) + (b.blocksMilestoneIds?.length || 0);
        comparison = bBlocking - aBlocking;
        break;
      case 'reportedAt':
        comparison = new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime();
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [openIssues, sortField, sortDirection]);
  
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const handleIssueClick = useCallback((issueId: string) => {
    onIssueClick?.(issueId);
  }, [onIssueClick]);
  
  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      )}
    </button>
  );
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Open Issues
          {openIssues.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {openIssues.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedIssues.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No open issues 🎉
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">
                    <SortHeader field="severity">Priority</SortHeader>
                  </th>
                  <th className="text-left py-3 px-2">
                    <SortHeader field="title">Issue</SortHeader>
                  </th>
                  <th className="text-left py-3 px-2">
                    <SortHeader field="blocking">Blocking</SortHeader>
                  </th>
                  <th className="text-left py-3 px-2">Assigned</th>
                  <th className="text-left py-3 px-2">
                    <SortHeader field="reportedAt">Reported</SortHeader>
                  </th>
                  <th className="text-right py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {sortedIssues.map((issue) => {
                  const config = severityConfig[issue.severity];
                  const SeverityIcon = config.icon;
                  const blockingCount = (issue.blocksTaskIds?.length || 0) + (issue.blocksMilestoneIds?.length || 0);
                  
                  return (
                    <tr 
                      key={issue.id}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleIssueClick(issue.id)}
                    >
                      <td className="py-3 px-2">
                        <Badge 
                          variant={issue.severity === 'critical' ? 'destructive' : 'outline'}
                          className={cn(
                            "gap-1",
                            issue.severity !== 'critical' && config.color
                          )}
                        >
                          <SeverityIcon className="h-3 w-3" />
                          <span className="capitalize">{issue.severity}</span>
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{issue.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {(issue.category || 'other').replace('-', ' ')}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {blockingCount > 0 ? (
                          <span className="text-destructive font-medium">
                            {blockingCount} item{blockingCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {issue.assignees && issue.assignees.length > 0 ? (
                          <div className="flex -space-x-2">
                            {issue.assignees.slice(0, 3).map((assignee) => (
                              <Avatar key={assignee.id} className="h-6 w-6 border-2 border-background">
                                <AvatarImage src={resolveFileUrl(assignee.avatar) ?? assignee.avatar} alt={assignee.name} />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {assignee.initials}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {issue.assignees.length > 3 && (
                              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] border-2 border-background">
                                +{issue.assignees.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {issue.reportedAt ? format(parseISO(issue.reportedAt), 'MMM dd') : '—'}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
