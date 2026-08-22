import { useState, useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from '@/components/ui/hover-card';
import { useProjectDetail, useProjectModules } from '@/hooks/useProjectDetail';
import { calculateProjectProgress } from '../utils/projectUtils';
import { ProjectProgressBreakdown } from './ProjectProgressPopover';
import { Skeleton } from '@/components/ui/skeleton';

interface ProjectListProgressProps {
    projectId: string;
    progress: number;
}

export function ProjectListProgress({ projectId, progress }: ProjectListProgressProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Fetch full project details and modules only when popover is open
    const { data: project, isLoading: isLoadingProject } = useProjectDetail(projectId, { enabled: isOpen });
    const { data: projectModules = [], isLoading: isLoadingModules } = useProjectModules(projectId, { enabled: isOpen });

    const isLoading = isLoadingProject || isLoadingModules;

    // Transform modules to match what calculateProjectProgress expects
    const modules = useMemo(() => {
        if (!projectModules) return [];
        return projectModules.map((m: any) => ({
            id: m.id,
            name: m.name,
            progress: m.progress || 0,
            // We don't need other fields for calculation
        }));
    }, [projectModules]);

    const breakdown = useMemo(() => {
        if (!project) return null;
        return calculateProjectProgress(
            project.tasks || [],
            project.milestones || [],
            modules,
            project.issues || []
        );
    }, [project, modules]);

    const displayProgress = breakdown ? breakdown.overallProgress : progress || 0;

    return (
        <HoverCard open={isOpen} onOpenChange={setIsOpen}>
            <HoverCardTrigger asChild>
                <div className="space-y-2 mb-4 cursor-help">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{displayProgress}%</span>
                    </div>
                    <Progress value={displayProgress} className="h-2" />
                </div>
            </HoverCardTrigger>
            <HoverCardContent
                className="w-64"
                align="start"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                onPointerDown={(e) => {
                    e.stopPropagation();
                }}
            >
                {isLoading ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-8" />
                        </div>
                        <div className="space-y-2">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-3 w-16" />
                                        <Skeleton className="h-3 w-6" />
                                    </div>
                                    <Skeleton className="h-1.5 w-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : breakdown ? (
                    <ProjectProgressBreakdown breakdown={breakdown} />
                ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                        No progress data available
                    </div>
                )}
            </HoverCardContent>
        </HoverCard>
    );
}
