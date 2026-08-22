import { useMemo, useState } from 'react';
import { Check, ChevronDown, Folder, Globe, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import type { AssistantScope } from '../assistantData';
import type { Project } from '@/types';

interface AssistantScopePopoverProps {
  scope: AssistantScope;
  onScopeChange: (scope: AssistantScope) => void;
  projects: Project[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string) => void;
}

export function AssistantScopePopover({
  scope,
  onScopeChange,
  projects,
  selectedProjectId,
  onProjectChange,
}: AssistantScopePopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(query));
  }, [projects, search]);

  const Icon = scope === 'All projects' ? Globe : Folder;
  const label = scope === 'All projects' ? 'Select a project' : selectedProject?.name ?? 'Select a project';

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
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
        <div className="relative px-1 pb-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-md border border-input bg-transparent py-1.5 pl-8 pr-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="max-h-40 overflow-y-auto">
          {filteredProjects.map((project) => (
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
          {projects.length > 0 && filteredProjects.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No projects match "{search}"</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
