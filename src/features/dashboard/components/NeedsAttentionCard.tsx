import { Link } from 'react-router-dom';
import { AlertTriangle, FolderKanban, XCircle, Zap, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { softTint } from '../utils/colors';

interface NeedsAttentionItem {
  key: string;
  icon: React.ElementType;
  color: string;
  title: string;
  description: string;
  to: string;
}

interface NeedsAttentionCardProps {
  overdueProject: { id: string; name: string; days: number; stageLabel: string } | null;
  atRiskCount: number;
  bomRejected: number;
}

export function NeedsAttentionCard({ overdueProject, atRiskCount, bomRejected }: NeedsAttentionCardProps) {
  const items: NeedsAttentionItem[] = [];

  if (overdueProject) {
    items.push({
      key: 'overdue-project',
      icon: AlertTriangle,
      color: '#DC2626',
      title: overdueProject.name,
      description: `${Math.abs(overdueProject.days)} days overdue · ${overdueProject.stageLabel}`,
      to: `/projects/${overdueProject.id}`,
    });
  }

  if (atRiskCount > 0) {
    items.push({
      key: 'projects-attention',
      icon: FolderKanban,
      color: '#D97706',
      title: `${atRiskCount} project${atRiskCount === 1 ? '' : 's'} need attention`,
      description: 'Behind schedule or at risk',
      to: '/projects',
    });
  }

  if (bomRejected > 0) {
    items.push({
      key: 'bom-rejected',
      icon: XCircle,
      color: '#DC2626',
      title: `${bomRejected} BOM part${bomRejected === 1 ? '' : 's'} rejected`,
      description: 'Needs review',
      to: '/projects',
    });
  }

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm overflow-hidden min-w-0">
      <CardHeader className="px-3 py-2.5 flex flex-row items-center justify-between gap-2 space-y-0">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-priority-medium">
          <Zap className="h-3.5 w-3.5" />
          Needs Attention
        </span>
        {items.length > 0 && (
          <span className="flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-status-blocked text-white text-[11px] font-bold">
            {items.length}
          </span>
        )}
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-status-done shrink-0" />
            All caught up — nothing needs attention.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className="flex items-center gap-3 py-2.5 -mx-1 px-1 rounded-md hover:bg-secondary/60 transition-colors"
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: softTint(item.color, 0.14) }}
                >
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{item.title}</span>
                  <span className="block text-xs text-muted-foreground truncate">{item.description}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
