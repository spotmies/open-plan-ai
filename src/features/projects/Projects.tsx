import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProjectListProgress } from './components/ProjectListProgress';
import { Plus, Search, Grid3X3, List, Users, MoreVertical, Eye, Pencil, Calendar, Link as LinkIcon, Paperclip, FileText, Flag, Target, FolderOpen, Package, X, Trash2, AlertTriangle, Loader2, Tag, Layers, Building2, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjects, useDeleteProject, useTogglePinProject } from '@/hooks/useProjects';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useProjectAttachments } from '@/hooks/useProjectAttachments';
import { useProjectLinks } from '@/hooks/useProjectLinks';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgPermissions } from '@/hooks/useProjectPermissions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logger } from '@/services/monitoring/logger';
import { resolveFileUrl } from '@/utils/fileUrl';
import { FilePreviewDialog } from '@/components/FilePreviewDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

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

// Mirrors the department list in NewProject.tsx / EditProject.tsx
const departmentLabels: Record<string, string> = {
  design: 'Design',
  hardware: 'Hardware',
  software: 'Software',
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  firmware: 'Firmware',
  testing: 'Testing & QA',
  manufacturing: 'Manufacturing',
  documentation: 'Documentation',
};

const formatDepartmentLabel = (id: string) => {
  if (departmentLabels[id]) return departmentLabels[id];
  const cleaned = id.startsWith('custom-') ? id.slice('custom-'.length) : id;
  return cleaned.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDisplayDate = (value?: string | number | Date | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

const getAttachmentMimeType = (attachment: any): string => {
  const mime = attachment?.mimeType || attachment?.mime_type;
  if (mime) return mime;
  const name: string = attachment?.file_name || attachment?.fileName || attachment?.name || '';
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return `image/${ext}`;
  return '';
};
const isImageAttachment = (attachment: any) => getAttachmentMimeType(attachment).startsWith('image/');

function ProjectTeamHoverCard({ projectId, memberCount }: { projectId: string; memberCount?: number }) {
  const [open, setOpen] = useState(false);
  const { data: members, isLoading } = useProjectMembers(open ? projectId : undefined);

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={150}>
      <HoverCardTrigger asChild>
        <div
          className="flex items-center gap-2 text-muted-foreground cursor-help"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Users className="h-4 w-4" />
          <span className="text-xs">{memberCount ?? 0}</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-72"
        align="start"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">Project Team</p>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-3/4" />
            </div>
          ) : members && members.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {members.map((member) => {
                const initials = member.initials || member.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <div key={member.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8 ring-2 ring-background">
                        <AvatarImage src={member.avatar || undefined} alt={member.name} referrerPolicy="no-referrer" />
                        <AvatarFallback className="text-[11px] font-medium">{initials}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm truncate">{member.name}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] max-w-[120px] truncate">
                      {member.role || 'Member'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No team members assigned yet.</p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const { data: projects, isLoading, error } = useProjects();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PROJECTS_PER_PAGE = 9;
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [selectedFilesProjectId, setSelectedFilesProjectId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<any>(null);

  // Fetch full project details when a project is selected for viewing details
  const { data: selectedProjectDetails, isLoading: isLoadingDetails } = useProjectDetail(selectedProjectId || undefined);
  // getProjectById doesn't return a populated `team` array — fetch members from the
  // dedicated endpoint instead (same source the card's team hover-card uses).
  const { data: selectedProjectTeam = [], isLoading: isLoadingTeam } = useProjectMembers(selectedProjectId || undefined);
  const { data: projectAttachments = [] } = useProjectAttachments(selectedProjectId || undefined);
  const { data: projectLinks = [] } = useProjectLinks(selectedProjectId || undefined);
  const { data: projectFiles = [], isLoading: isLoadingFiles } = useProjectAttachments(selectedFilesProjectId || undefined);
  const deleteProjectMutation = useDeleteProject();
  const togglePinMutation = useTogglePinProject();
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [deleteProjectConfirmText, setDeleteProjectConfirmText] = useState('');

  const projectList = projects || [];
  const { canCreateProject } = useOrgPermissions();

  useEffect(() => {
    document.title = 'Projects | Open Plan AI';
    return () => { document.title = 'Open Plan AI'; };
  }, []);

  useEffect(() => {
    if (isMobile && view !== 'list') {
      setView('list');
    }
  }, [isMobile, view]);

  // Pinned projects always sort first, regardless of search — lets users
  // with many projects jump straight to the ones they use most.
  const filteredProjects = projectList
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE));
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * PROJECTS_PER_PAGE,
    currentPage * PROJECTS_PER_PAGE
  );

  // Reset to page 1 whenever the search changes
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleViewDetails = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedProjectId(projectId);
    setDetailsDialogOpen(true);
  };

  const handleViewFiles = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFilesProjectId(projectId);
    setFilesDialogOpen(true);
  };

  const handleEdit = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/projects/${projectId}/edit`);
  };

  const handleTogglePin = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePinMutation.mutate(projectId, {
      onError: () => toast.error('Failed to update pin'),
    });
  };

  const canEditSelectedProject = (() => {
    if (!selectedProjectDetails || !user?.id) return false;
    if (selectedProjectDetails.createdBy === user.id) return true;
    const role = (selectedProjectDetails.myRole || '').toLowerCase();
    return role === 'admin';
  })();

  const isProjectOwner = canEditSelectedProject;

  const canEditProject = (project: { createdBy?: string; myRole?: string }) => {
    if (!user?.id) return false;
    if (project.createdBy === user.id) return true;
    return (project.myRole || '').toLowerCase() === 'admin';
  };

  const handleDeleteProject = async () => {
    if (!selectedProjectDetails?.id) return;
    if (deleteProjectConfirmText.trim() !== selectedProjectDetails.name) {
      toast.error('Project name does not match.');
      return;
    }
    try {
      await deleteProjectMutation.mutateAsync(selectedProjectDetails.id);
      toast.success('Project deleted successfully');
      setDeleteProjectDialogOpen(false);
      setDeleteProjectConfirmText('');
      setDetailsDialogOpen(false);
      setSelectedProjectId(null);
    } catch (error) {
      logger.error('Error deleting project:', error);
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.toLowerCase().includes('access denied')) {
        toast.error('Only the project owner can delete this project.');
      } else {
        toast.error('Failed to delete project');
      }
    }
  };

  // Show the skeleton while the org is still resolving too — otherwise the
  // org-scoped projects query is disabled (isLoading=false) and we briefly flash
  // the "No projects found" empty state before the real loading shimmer.
  if (orgLoading || isLoading) {
    return <AppLayoutSkeleton variant="projects" />;
  }

  if (error) {
    return (
      <>
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">Failed to load projects</h3>
          <p className="text-muted-foreground">Please try again later</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={cn('space-y-4 md:space-y-6 animate-fade-in')}>
        <div className={cn(
          isMobile
            ? 'space-y-2.5'
            : 'space-y-2.5 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-2.5 md:p-0 md:border-0 md:bg-transparent md:backdrop-blur-0'
        )}>
          <div className={cn('flex items-center gap-2 md:gap-4')}>
            {isMobile ? (
              <div className="relative flex-1 max-w-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search projects..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-9 h-12 rounded-2xl bg-background border border-border/60 shadow-sm focus-visible:ring-1 focus-visible:ring-border"
                />
                {search && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-12 w-9 text-foreground/70 hover:text-foreground"
                    onClick={() => handleSearch('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="relative flex-1 max-w-none md:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-9 h-10 md:h-9 rounded-xl md:rounded-md bg-background/80"
                />
                {search && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 md:h-9 w-9 text-foreground/70 hover:text-foreground"
                    onClick={() => handleSearch('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {isMobile ? (
              canCreateProject ? (
                <Button
                  size="icon"
                  className="h-12 w-12 rounded-2xl shrink-0 bg-foreground text-background shadow-[0_8px_24px_rgba(0,0,0,0.22)] hover:bg-foreground/90"
                  onClick={() => navigate('/projects/new')}
                  aria-label="Create project"
                  title="New Project"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              ) : null
            ) : (
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                <div className="flex border border-border/70 rounded-xl md:rounded-lg bg-background/60">
                  <Button
                    variant={view === 'grid' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-10 w-10 md:h-9 md:w-9 rounded-r-none"
                    onClick={() => setView('grid')}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={view === 'list' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-10 w-10 md:h-9 md:w-9 rounded-l-none"
                    onClick={() => setView('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                {canCreateProject && (
                  <Button className="gap-2 shrink-0" onClick={() => navigate('/projects/new')}>
                    <Plus className="h-4 w-4" />
                    New Project
                  </Button>
                )}
              </div>
            )}
        </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium">No projects found</h3>
            <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
              {projectList.length === 0
                ? canCreateProject
                  ? isMobile
                    ? 'Tap the + button above to create your first project.'
                    : 'Use the New Project button above to get started.'
                  : 'Only organization admins and managers can create projects.'
                : 'Try adjusting your search query'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={cn(
              view === 'grid'
                ? 'grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3'
                : 'space-y-3'
            )}>
              {paginatedProjects.map((project) => (
                <Link key={project.id} to={`/projects/${project.id}`} className="block h-full">
                  <Card className={cn(
                    'rounded-2xl border-border/70 bg-gradient-to-b from-card to-card/80 card-hover cursor-pointer h-full flex flex-col',
                    isMobile
                      ? 'p-3 shadow-[0_4px_16px_rgba(0,0,0,0.10)]'
                      : 'p-4 md:p-5 shadow-[0_10px_30px_rgba(0,0,0,0.16)]'
                  )}>
                    <div className={cn('flex items-start justify-between gap-3 flex-1', isMobile ? 'mb-2' : 'mb-4')}>
                      <div className="min-w-0 flex-1">
                        <h3 className={cn('font-semibold truncate flex items-center gap-2', isMobile ? 'text-sm' : '')}>
                          {project.logoUrl ? (
                            <img
                              src={resolveFileUrl(project.logoUrl) ?? project.logoUrl}
                              alt=""
                              className={cn('rounded object-cover shrink-0', isMobile ? 'h-4 w-4' : 'h-5 w-5')}
                            />
                          ) : isMobile ? (
                            <span className="text-base">📁</span>
                          ) : (
                            project.icon && <span className="text-lg">{project.icon}</span>
                          )}
                          {project.name}
                        </h3>
                        <p className={cn('text-muted-foreground/90 mt-0.5', isMobile ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2')}>
                          {project.description || 'No description'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {project.pinned && (
                          <Pin className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />
                        )}
                        <Badge variant="secondary" className={cn(stageColors[project.stage as keyof typeof stageColors] || stageColors.concept)}>
                          {stageLabels[project.stage as keyof typeof stageLabels] || project.stage}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Project menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => handleTogglePin(project.id, e)}>
                              {project.pinned ? (
                                <>
                                  <PinOff className="h-4 w-4 mr-2" />
                                  Unpin
                                </>
                              ) : (
                                <>
                                  <Pin className="h-4 w-4 mr-2" />
                                  Pin to top
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => handleViewDetails(project.id, e)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleViewFiles(project.id, e)}>
                              <FolderOpen className="h-4 w-4 mr-2" />
                              View Files
                            </DropdownMenuItem>
                            {canEditProject(project) && (
                              <DropdownMenuItem onClick={(e) => handleEdit(project.id, e)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <ProjectListProgress projectId={project.id} progress={project.progress || 0} />

                    <div className="flex items-center justify-between pt-3 border-t border-border/60">
                      <ProjectTeamHoverCard
                        projectId={project.id}
                        memberCount={project.memberCount ?? project.team?.length}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        Updated {formatDisplayDate(project.updatedAt)}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 rounded-lg text-xs"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  ← Prev
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 w-8 rounded-lg text-xs p-0"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 rounded-lg text-xs"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next →
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Project Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl h-[85vh] w-[min(95vw,42rem)] overflow-hidden p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b bg-background shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {selectedProjectDetails?.name || 'Project Details'}
              {selectedProjectDetails?.stage && (
                <Badge variant="secondary" className={cn(stageColors[selectedProjectDetails.stage as keyof typeof stageColors] || stageColors.concept)}>
                  {stageLabels[selectedProjectDetails.stage as keyof typeof stageLabels] || selectedProjectDetails.stage}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoadingDetails ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : selectedProjectDetails ? (
              <div className="space-y-6">
                {/* Description */}
                {selectedProjectDetails.description && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Description
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {selectedProjectDetails.description}
                    </p>
                  </div>
                )}

                {/* Project Type & Stage */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Project Type
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedProjectDetails.type || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Project Stage
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {stageLabels[selectedProjectDetails.stage as keyof typeof stageLabels] || selectedProjectDetails.stage}
                    </p>
                  </div>
                </div>

                {/* Departments */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Department{(selectedProjectDetails.departments?.length ?? 0) !== 1 ? 's' : ''}
                  </h4>
                  {selectedProjectDetails.departments && selectedProjectDetails.departments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedProjectDetails.departments.map((deptId) => (
                        <Badge key={deptId} variant="outline" className="text-xs font-normal">
                          {formatDepartmentLabel(deptId)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No departments assigned.</p>
                  )}
                </div>

                {/* Progress */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Progress
                  </h4>
                  <div className="flex items-center gap-3">
                    <Progress value={selectedProjectDetails.progress || 0} className="flex-1" />
                    <span className="text-sm font-medium">{selectedProjectDetails.progress || 0}%</span>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Start Date
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedProjectDetails.startDate ? formatDisplayDate(selectedProjectDetails.startDate) : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Flag className="h-4 w-4" />
                      Target Date
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedProjectDetails.targetDate ? formatDisplayDate(selectedProjectDetails.targetDate) : 'Not set'}
                    </p>
                  </div>
                </div>

                {/* Team Members */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Team Members {selectedProjectTeam.length > 0 && `(${selectedProjectTeam.length})`}
                  </h4>
                  {isLoadingTeam ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : selectedProjectTeam.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedProjectTeam.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={member.avatar || undefined} alt={member.name} referrerPolicy="no-referrer" />
                            <AvatarFallback className="text-[11px] font-bold text-primary bg-primary/10">
                              {member.initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{member.name}</p>
                            {member.role && (
                              <p className="text-[11px] text-muted-foreground capitalize flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                {member.role.replace('_', ' ')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
                  )}
                </div>

                {/* Attachments */}
                {projectAttachments.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Attachments ({projectAttachments.length})
                    </h4>
                    <div className="space-y-2">
                      {projectAttachments.map((attachment: any) => {
                        const attachmentName = attachment.file_name || attachment.fileName || attachment.name || 'Untitled file';
                        const rawUrl = attachment.url || attachment.fileUrl;
                        const previewUrl = resolveFileUrl(rawUrl) ?? rawUrl;
                        return (
                          <div
                            key={attachment.id}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors",
                              previewUrl ? "cursor-pointer" : "cursor-default"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (previewUrl) setPreviewFile(attachment);
                            }}
                          >
                            {previewUrl && isImageAttachment(attachment) ? (
                              <img
                                src={previewUrl}
                                alt={attachmentName}
                                className="h-8 w-8 rounded object-cover shrink-0"
                              />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-sm flex-1 truncate">{attachmentName}</span>
                            {previewUrl && (
                              <Eye className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Links */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Project Links {projectLinks.length > 0 && `(${projectLinks.length})`}
                  </h4>
                  {projectLinks.length > 0 ? (
                    <div className="space-y-2">
                      {projectLinks.map((link: any) => (
                        <div key={link.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                          <LinkIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm flex-1">{link.title || link.name}</span>
                          {link.url && (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate max-w-[200px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {link.url}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No links added.</p>
                  )}
                </div>

                {/* Modules List */}
                {selectedProjectDetails.projectModules && selectedProjectDetails.projectModules.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Modules ({selectedProjectDetails.projectModules.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedProjectDetails.projectModules.map((module) => (
                        <Badge key={module.id} variant="outline" className="text-xs font-normal">
                          <span className="font-semibold">{module.name}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Milestones count */}
                {selectedProjectDetails.milestones && selectedProjectDetails.milestones.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Flag className="h-4 w-4" />
                      Milestones ({selectedProjectDetails.milestones.length})
                    </h4>
                    <div className="space-y-1">
                      {selectedProjectDetails.milestones.slice(0, 3).map((milestone) => (
                        <div key={milestone.id} className="flex items-center gap-2 text-sm">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            milestone.completed ? "bg-green-500" : "bg-muted-foreground"
                          )} />
                          <span className={milestone.completed ? "line-through text-muted-foreground" : ""}>
                            {milestone.title}
                          </span>
                        </div>
                      ))}
                      {selectedProjectDetails.milestones.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{selectedProjectDetails.milestones.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No project details available.</p>
            )}
          </div>

          {selectedProjectDetails && !isLoadingDetails && (
            <div className="px-6 py-4 border-t bg-background shrink-0 space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDetailsDialogOpen(false);
                    navigate(`/projects/${selectedProjectId}`);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Open Project
                </Button>
                {canEditSelectedProject && (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      navigate(`/projects/${selectedProjectId}/edit`);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Project
                  </Button>
                )}
              </div>
              {isProjectOwner && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setDeleteProjectDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog
        open={deleteProjectDialogOpen}
        onOpenChange={(open) => {
          setDeleteProjectDialogOpen(open);
          if (!open) setDeleteProjectConfirmText('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              To confirm deletion, type <strong>{selectedProjectDetails?.name}</strong> below. This permanently deletes the project and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-project-confirmation">Project Name</Label>
            <Input
              id="delete-project-confirmation"
              value={deleteProjectConfirmText}
              onChange={(e) => setDeleteProjectConfirmText(e.target.value)}
              placeholder={selectedProjectDetails?.name}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteProjectDialogOpen(false);
                setDeleteProjectConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={
                deleteProjectMutation.isPending ||
                deleteProjectConfirmText.trim() !== selectedProjectDetails?.name
              }
            >
              {deleteProjectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete Permanently'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Files Dialog */}
      <Dialog open={filesDialogOpen} onOpenChange={setFilesDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Project Files
            </DialogTitle>
            <DialogDescription>
              All files attached to this project.
            </DialogDescription>
          </DialogHeader>

          {isLoadingFiles ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : projectFiles.length > 0 ? (
            <div className="space-y-2 py-4">
              {projectFiles.map((file: any) => {
                const rawUrl = file.url || file.fileUrl;
                const previewUrl = resolveFileUrl(rawUrl) ?? rawUrl;
                const fileName = file.file_name || file.fileName || file.name || 'Untitled file';
                return (
                  <div
                    key={file.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors border",
                      previewUrl ? "cursor-pointer" : "cursor-default opacity-70"
                    )}
                    onClick={() => previewUrl && setPreviewFile(file)}
                  >
                    {previewUrl && isImageAttachment(file) ? (
                      <img
                        src={previewUrl}
                        alt={fileName}
                        className="h-9 w-9 rounded object-cover shrink-0"
                      />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">
                        {fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {previewUrl ? "Click to preview" : "No preview available"} • {formatDisplayDate(file.uploaded_at || file.createdAt || Date.now())}
                      </p>
                    </div>
                    {previewUrl && (
                      <Eye className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Paperclip className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-foreground">No files attached</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This project doesn't have any attached files yet. Files can be added when editing the project.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setFilesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      {previewFile && (() => {
        const rawUrl = previewFile.url || previewFile.fileUrl;
        const url = resolveFileUrl(rawUrl) ?? rawUrl;
        return (
          <FilePreviewDialog
            file={{
              url,
              fileName: previewFile.file_name || previewFile.fileName || previewFile.name || 'Untitled file',
              mimeType: getAttachmentMimeType(previewFile) || undefined,
            }}
            onClose={() => setPreviewFile(null)}
          />
        );
      })()}

    </>
  );
}
