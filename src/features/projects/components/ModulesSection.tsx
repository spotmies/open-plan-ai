import { useState, useMemo, useEffect } from 'react';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Module, ModuleViewMode, Task, Issue, TeamMember, ModuleType } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { ModulesKanbanView } from './ModulesKanbanView';
import { ModulesListView } from './ModulesListView';
import { ModulesMobileView } from './ModulesMobileView';
import { ModuleDetailMobileView } from './ModuleDetailMobileView';
import { ModuleDetailModal } from './ModuleDetailModal';
import { TaskDetailModal } from './TaskDetailModal';
import { IssueDetailModal } from './IssueDetailModal';
import { AddModuleDialog } from './AddModuleDialog';
import { getModuleTasks, getModuleProgress } from '../utils/projectUtils';


interface ModuleWithStats extends Module {
  taskCount: number;
  progress: number;
  openIssues: number;
  tasks: Task[];
}

interface ModulesSectionProps {
  modules: Module[];
  tasks: Task[];
  issues: Issue[];
  teamMembers: TeamMember[];
  projectId?: string;
  projectCode?: string;
  viewMode?: ModuleViewMode;
  onViewModeChange?: (mode: ModuleViewMode) => void;
  searchQuery?: string;
  isAddDialogOpen?: boolean;
  onAddDialogClose?: () => void;
  onModuleAdd?: (module: Omit<Module, 'id' | 'createdAt'>) => void;
  onModuleUpdate?: (module: Module) => Promise<boolean> | boolean | void;
  onModuleDelete?: (moduleId: string) => void;
  onTaskClick?: (task: Task) => void;
  onIssueClick?: (issue: Issue) => void;
  onTaskUpdate?: (task: Task) => void;
  onIssueUpdate?: (issue: Issue) => void;
  /** Notifies the parent when the mobile full-page module detail view opens/closes,
   *  so it can hide its own tab strip and search bar (which live outside this component). */
  onMobileDetailOpenChange?: (isOpen: boolean) => void;
}

export function ModuleViewControls({
  viewMode,
  onViewModeChange,
  onAddModule,
}: {
  viewMode: ModuleViewMode;
  onViewModeChange: (mode: ModuleViewMode) => void;
  onAddModule?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value) => value && onViewModeChange(value as ModuleViewMode)}
        className="bg-muted/50 p-1 rounded-lg"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="kanban" aria-label="Kanban view" className="h-8 w-8 p-0 data-[state=on]:bg-background">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="top">Kanban View</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="list" aria-label="List view" className="h-8 w-8 p-0 data-[state=on]:bg-background">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="top">List View</TooltipContent>
        </Tooltip>
      </ToggleGroup>

      {onAddModule && (
        <Button size="sm" className="gap-2 shrink-0 px-2 md:px-3" onClick={onAddModule}>
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline">Add Module</span>
        </Button>
      )}
    </div>
  );
}

export function ModulesSection({
  modules,
  tasks,
  issues,
  teamMembers,
  projectId,
  projectCode,
  viewMode: externalViewMode,
  onViewModeChange: externalOnViewModeChange,
  searchQuery = '',
  isAddDialogOpen: externalIsAddDialogOpen,
  onAddDialogClose,
  onModuleAdd,
  onModuleUpdate,
  onModuleDelete,
  onTaskClick,
  onIssueClick,
  onTaskUpdate,
  onIssueUpdate,
  onMobileDetailOpenChange,
}: ModulesSectionProps) {
  const isMobile = useIsMobile();
  const [selectedModule, setSelectedModule] = useState<ModuleWithStats | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  useEffect(() => {
    onMobileDetailOpenChange?.(isMobile && !!selectedModule);
    // Restore the parent's tab strip/search bar if this component unmounts
    // (e.g. navigating away) while the mobile detail view is open.
    return () => onMobileDetailOpenChange?.(false);
  }, [isMobile, selectedModule, onMobileDetailOpenChange]);

  // Hide the module modal while a task/issue modal is open on top of it — otherwise
  // both dialogs' overlays stack and compound into a near-opaque black background.
  const handleInternalTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(false);
  };
  const effectiveOnTaskClick = onTaskClick ?? handleInternalTaskClick;

  const handleInternalIssueClick = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsDetailModalOpen(false);
  };
  const effectiveOnIssueClick = onIssueClick ?? handleInternalIssueClick;

  const handleCloseTaskModal = () => {
    setSelectedTask(null);
    if (selectedModule) setIsDetailModalOpen(true);
  };

  const handleCloseIssueModal = () => {
    setSelectedIssue(null);
    if (selectedModule) setIsDetailModalOpen(true);
  };

  const viewMode = externalViewMode || 'kanban';

  // Filter modules by search query
  const filteredModules = searchQuery.trim()
    ? modules.filter(m =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : modules;

  // Calculate module stats
  const modulesWithStats = useMemo(() => {
    return filteredModules.map(module => {
      const moduleTasks = getModuleTasks(module.id, tasks);
      const progress = getModuleProgress(module.id, tasks);
      const openIssues = issues.filter(
        i => i.moduleId === module.id && i.status !== 'resolved'
      ).length;

      return {
        ...module,
        taskCount: moduleTasks.length,
        progress,
        openIssues,
        tasks: moduleTasks,
      };
    });
  }, [filteredModules, tasks, issues]);

  const handleModuleClick = (module: ModuleWithStats) => {
    setSelectedModule(module);
    if (!isMobile) setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedModule(null);
  };

  const handleModuleUpdateFromModal = async (updatedModule: Module): Promise<boolean> => {
    try {
      const didSave = await onModuleUpdate?.(updatedModule);
      if (didSave === false) return false;

      // Reflect the saved state in the open detail modal.
      setSelectedModule(prev => {
        if (!prev || prev.id !== updatedModule.id) return prev;
        const updatedTasks = getModuleTasks(updatedModule.id, tasks);
        return {
          ...prev,
          ...updatedModule,
          tasks: updatedTasks,
          taskCount: updatedTasks.length,
          progress: getModuleProgress(updatedModule.id, tasks),
          openIssues: issues.filter(
            i => i.moduleId === updatedModule.id && i.status !== 'resolved'
          ).length,
        };
      });

      return true;
    } catch {
      return false;
    }
  };

  const handleAddModule = (newModule: Omit<Module, 'id' | 'createdAt'>) => {
    onModuleAdd?.(newModule);
  };

  const handleLinkTask = (taskId: string, moduleId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && onTaskUpdate) {
      const currentIds = task.moduleIds || (task.moduleId ? [task.moduleId] : []);
      if (!currentIds.includes(moduleId)) {
        onTaskUpdate({
          ...task,
          moduleIds: [...currentIds, moduleId],
          moduleId: currentIds.length === 0 ? moduleId : task.moduleId,
          module: currentIds.length === 0 ? (modules.find(m => m.id === moduleId)?.type || task.module) : task.module
        });
      }
    }
  };

  const handleUnlinkTask = (taskId: string, moduleId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && onTaskUpdate) {
      const currentIds = task.moduleIds || (task.moduleId ? [task.moduleId] : []);
      const updatedIds = currentIds.filter(id => id !== moduleId);

      const nextModuleId = updatedIds.length > 0 ? updatedIds[0] : undefined;
      const nextModuleType = nextModuleId ? (modules.find(m => m.id === nextModuleId)?.type || task.module) : task.module;

      onTaskUpdate({
        ...task,
        moduleIds: updatedIds,
        moduleId: nextModuleId,
        module: nextModuleType as ModuleType
      });
    }
  };

  const handleLinkIssue = (issueId: string, moduleId: string) => {
    const issue = issues.find(i => i.id === issueId);
    if (issue && onIssueUpdate) {
      onIssueUpdate({ ...issue, moduleId });
    }
  };

  const handleUnlinkIssue = (issueId: string, moduleId: string) => {
    const issue = issues.find(i => i.id === issueId);
    if (issue && onIssueUpdate) {
      onIssueUpdate({ ...issue, moduleId: undefined });
    }
  };

  const existingModuleNames = modules.map(m => m.name);

  return (
    <>
      <div className="space-y-4 grid grid-cols-1 w-full min-w-0">
        {/* View Content */}
        <div className="min-h-[400px] w-full min-w-0">
          {isMobile ? (
            selectedModule ? (
              <ModuleDetailMobileView
                module={selectedModule}
                allTasks={tasks}
                allIssues={issues}
                teamMembers={teamMembers}
                projectId={projectId}
                onBack={handleCloseDetailModal}
                onUpdate={handleModuleUpdateFromModal}
                onDelete={onModuleDelete}
                onTaskClick={effectiveOnTaskClick}
                onIssueClick={effectiveOnIssueClick}
                onLinkTask={handleLinkTask}
                onLinkIssue={handleLinkIssue}
              />
            ) : (
              <ModulesMobileView
                modules={modulesWithStats}
                onModuleClick={handleModuleClick}
              />
            )
          ) : viewMode === 'kanban' ? (
            <ModulesKanbanView
              modules={modulesWithStats}
              onModuleClick={handleModuleClick}
            />
          ) : (
            <ModulesListView
              modules={modulesWithStats}
              onModuleClick={handleModuleClick}
            />
          )}
        </div>
      </div>

      {/* Module Detail Modal (desktop only — mobile uses ModuleDetailMobileView above) */}
      <ModuleDetailModal
        module={selectedModule}
        allTasks={tasks}
        allIssues={issues}
        teamMembers={teamMembers}
        isOpen={isDetailModalOpen && !isMobile}
        onClose={handleCloseDetailModal}
        onUpdate={handleModuleUpdateFromModal}
        onDelete={onModuleDelete}
        onTaskClick={effectiveOnTaskClick}
        onIssueClick={effectiveOnIssueClick}
        onLinkTask={handleLinkTask}
        onUnlinkTask={handleUnlinkTask}
        onLinkIssue={handleLinkIssue}
        onUnlinkIssue={handleUnlinkIssue}
      />

      {!onTaskClick && (
        <TaskDetailModal
          task={selectedTask}
          allTasks={tasks}
          isOpen={selectedTask !== null}
          onClose={handleCloseTaskModal}
          onUpdate={(updatedTask) => {
            onTaskUpdate?.(updatedTask);
            setSelectedTask(updatedTask);
          }}
          modules={modules.map(m => ({ id: m.id, name: m.name, type: m.type }))}
          assignableMembers={teamMembers}
          projectCode={projectCode}
        />
      )}

      {!onIssueClick && (
        <IssueDetailModal
          issue={selectedIssue}
          tasks={tasks}
          teamMembers={teamMembers}
          isOpen={selectedIssue !== null}
          onClose={handleCloseIssueModal}
          onUpdate={(updatedIssue) => {
            onIssueUpdate?.(updatedIssue);
            setSelectedIssue(updatedIssue);
          }}
          projectCode={projectCode}
        />
      )}
    </>
  );
}

// Export a function to open the add dialog from parent
export function useModulesSectionControls() {
  const [internalViewMode, setInternalViewMode] = useState<ModuleViewMode>('kanban');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  return {
    isAddDialogOpen,
    internalViewMode,
    setInternalViewMode,
    openAddDialog: () => setIsAddDialogOpen(true),
    closeAddDialog: () => setIsAddDialogOpen(false),
  };
}
