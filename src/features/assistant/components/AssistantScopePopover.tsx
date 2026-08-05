import { useState } from 'react';
import { Check, ChevronDown, Folder, Globe, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ASSISTANT_FOCUS_ENTITIES, type AssistantScope, type AssistantFocusEntity } from '../assistantData';
import type { Project } from '@/types';

interface AssistantScopePopoverProps {
  scope: AssistantScope;
  onScopeChange: (scope: AssistantScope) => void;
  projects: Project[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  focusEntities: AssistantFocusEntity[];
  onFocusEntitiesChange: (entities: AssistantFocusEntity[]) => void;
}

export function AssistantScopePopover({
  scope,
  onScopeChange,
  projects,
  selectedProjectId,
  onProjectChange,
  focusEntities,
  onFocusEntitiesChange,
}: AssistantScopePopoverProps) {
  const [open, setOpen] = useState(false);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const Icon = scope === 'All projects' ? Globe : focusEntities.length > 0 ? Layers : Folder;
  const focusLabels = focusEntities.map((id) => ASSISTANT_FOCUS_ENTITIES.find((e) => e.id === id)?.label ?? id);
  const focusSuffix =
    focusLabels.length === 0
      ? ''
      : focusLabels.length <= 2
        ? ` · ${focusLabels.join(', ')}`
        : ` · ${focusLabels.length} focuses`;
  const label =
    scope === 'All projects'
      ? `All projects${focusSuffix}`
      : `${selectedProject?.name ?? 'Select a project'}${focusSuffix}`;

  const toggleFocusEntity = (id: AssistantFocusEntity) => {
    onFocusEntitiesChange(
      focusEntities.includes(id) ? focusEntities.filter((f) => f !== id) : [...focusEntities, id],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 max-w-[220px] gap-1.5 rounded-full text-xs font-normal text-muted-foreground"
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-64 p-1">
        <button
          type="button"
          onClick={() => {
            onScopeChange('All projects');
            setOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
        >
          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 min-w-0 truncate">All projects</span>
          {scope === 'All projects' && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </button>

        <Separator className="my-1" />
        <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Project
        </p>
        <div className="max-h-40 overflow-y-auto">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => {
                onProjectChange(project.id);
                onScopeChange('This project');
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            >
              <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 min-w-0 truncate">{project.name}</span>
              {scope !== 'All projects' && project.id === selectedProjectId && (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </button>
          ))}
          {projects.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No projects yet</p>}
        </div>

        <Separator className="my-1" />
        <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Focus — pick any
        </p>
        <div className="grid grid-cols-2 gap-1 p-1">
          {ASSISTANT_FOCUS_ENTITIES.map((entity) => {
            const selected = focusEntities.includes(entity.id);
            return (
              <button
                key={entity.id}
                type="button"
                onClick={() => toggleFocusEntity(entity.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                  selected ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/50',
                )}
              >
                <entity.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 min-w-0 truncate">{entity.label}</span>
                {selected && <Check className="h-3 w-3 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
