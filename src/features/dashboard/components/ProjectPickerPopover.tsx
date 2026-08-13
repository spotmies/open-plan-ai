import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { resolveFileUrl } from '@/utils/fileUrl';
import type { Project } from '@/types';

interface ProjectPickerPopoverProps {
  projects: Project[];
  tab: 'eng-changes' | 'bom';
  label: string;
  className?: string;
}

export function ProjectPickerPopover({ projects, tab, label, className }: ProjectPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function handleSelect(projectId: string) {
    setOpen(false);
    navigate(`/projects/${projectId}/${tab}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn('text-muted-foreground hover:text-foreground', className)}>
          {label}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Select project
        </p>
        {projects.length === 0 && (
          <p className="px-2 py-2 text-sm text-muted-foreground">No projects found.</p>
        )}
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => handleSelect(project.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent transition-colors text-left"
          >
            {project.logoUrl ? (
              <img
                src={resolveFileUrl(project.logoUrl) ?? project.logoUrl}
                alt=""
                className="h-4 w-4 rounded object-cover shrink-0"
              />
            ) : (
              project.icon && <span className="text-base leading-none">{project.icon}</span>
            )}
            <span className="flex-1 min-w-0 truncate font-medium">{project.name}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
