import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle, FolderOpen, FolderKanban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Project } from '@/types';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { projectHealth, varianceLabel, RAG_DOT_CLASS, RAG_BAR_CLASS, RAG_LABEL } from '../utils/projectHealth';
import { PanelIcon } from './PanelIcon';

interface ProjectsOverviewProps {
  projects: Project[];
  atRiskProjectIds: Set<string>;
}

const stageColors = {
  concept: 'bg-muted text-muted-foreground',
  design: 'bg-chart-1/10 text-chart-1',
  development: 'bg-chart-2/10 text-chart-2',
  testing: 'bg-chart-4/10 text-chart-4',
  production: 'bg-chart-3/10 text-chart-3',
};

const stageLabels = {
  concept: 'Concept',
  design: 'Design',
  development: 'Development',
  testing: 'Testing',
  production: 'Production',
};

const RAG_RANK = { red: 0, amber: 1, green: 2 };

export function ProjectsOverview({ projects, atRiskProjectIds }: ProjectsOverviewProps) {
  const isMobile = useIsMobile();
  const ranked = projects
    .map((p) => ({ project: p, health: projectHealth(p, atRiskProjectIds.has(p.id)) }))
    .sort((a, b) => RAG_RANK[a.health.rag] - RAG_RANK[b.health.rag]);
  const onTrack = ranked.filter((r) => r.health.rag === 'green').length;

  return (
    <Card className="flex flex-col h-full min-h-0 overflow-hidden">
      <CardHeader className="px-3 py-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="min-w-0 text-base font-medium flex items-center gap-2">
          <PanelIcon icon={FolderKanban} color="#2563EB" />
          <span className="truncate">{isMobile ? 'Projects' : 'Project Management'}</span>
        </CardTitle>
        <Button variant="ghost" size="sm" className="shrink-0" asChild>
          <Link to="/projects" className="text-muted-foreground hover:text-foreground">
            {isMobile ? 'View All' : 'All projects'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0 px-3 md:px-6 pb-4">
        {ranked.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center animate-fade-in py-8">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <FolderOpen className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <h3 className="text-sm font-medium text-foreground">No active projects</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              You don't have any active projects at the moment.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" asChild>
              <Link to="/projects">Create Project</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="shrink-0 flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{onTrack}/{ranked.length}</span> on track
              <span className="mx-0.5 text-border">·</span>
              <span className={cn('font-semibold tabular-nums', ranked.length - onTrack ? 'text-priority-medium' : 'text-foreground')}>
                {ranked.length - onTrack}
              </span>{' '}
              need attention
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="divide-y divide-border/50">
                {ranked.map(({ project, health }) => (
                isMobile ? (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="flex flex-col gap-2 py-3 px-2 rounded-md hover:bg-secondary/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span title={RAG_LABEL[health.rag]} className={cn('h-2.5 w-2.5 rounded-full shrink-0', RAG_DOT_CLASS[health.rag])} />
                      <span className="text-sm font-medium truncate flex-1" title={project.name}>{project.name}</span>
                      <Badge variant="secondary" className={cn('shrink-0 text-[10.5px]', stageColors[project.stage])}>
                        {stageLabels[project.stage]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={project.progress} className="h-1.5 flex-1" indicatorClassName={RAG_BAR_CLASS[health.rag]} />
                      <span className="text-[11px] font-semibold tabular-nums shrink-0">{project.progress}%</span>
                      <span className={cn(
                        'flex items-center gap-1 text-[11px] whitespace-nowrap shrink-0',
                        health.days < 0 ? 'text-status-blocked' : 'text-muted-foreground',
                      )}>
                        {health.days < 0 && <AlertTriangle className="h-3 w-3" />}
                        {varianceLabel(health.days)}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="grid grid-cols-[9px_minmax(0,1fr)_108px_70px] items-center gap-3 py-2.5 px-2 rounded-md hover:bg-secondary/60 transition-colors"
                  >
                    <span title={RAG_LABEL[health.rag]} className={cn('h-2.5 w-2.5 rounded-full', RAG_DOT_CLASS[health.rag])} />
                    <div className="min-w-0 flex flex-col gap-1">
                      <span className="text-sm font-medium truncate" title={project.name}>{project.name}</span>
                      <Badge variant="secondary" className={cn('shrink-0 text-[10.5px] w-fit', stageColors[project.stage])}>
                        {stageLabels[project.stage]}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-muted-foreground text-right tabular-nums">{project.progress}%</span>
                      <Progress value={project.progress} className="h-1.5" indicatorClassName={RAG_BAR_CLASS[health.rag]} />
                    </div>
                    <span className={cn(
                      'flex items-center justify-end gap-1 text-[11.5px] whitespace-nowrap',
                      health.days < 0 ? 'text-status-blocked' : 'text-muted-foreground',
                    )}>
                      {health.days < 0 && <AlertTriangle className="h-3 w-3" />}
                      {varianceLabel(health.days)}
                    </span>
                  </Link>
                )
              ))}
            </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
