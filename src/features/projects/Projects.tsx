import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProjectListProgress } from './components/ProjectListProgress';
import { Plus, Search, Grid3X3, List, Users, MoreVertical, Eye, Pencil, Paperclip, FileText, FolderOpen, X, AlertTriangle, Loader2, Pin, PinOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  formatDisplayDate,
  getAttachmentMimeType,
  isImageAttachment,
  stageColors,
  stageLabels,
} from './utils/projectDisplay';



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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [selectedFilesProjectId, setSelectedFilesProjectId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);

  // Fetch full project details when a project is selected for viewing details
  const { data: selectedProjectDetails } = useProjectDetail(selectedProjectId || undefined);
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
    navigate(`/projects/${projectId}/details`);
  };

  // Delete lives on the card menu now that the details dialog it used to sit
  // inside has been replaced by the full details page.
  const handleRequestDelete = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedProjectId(projectId);
    setDeleteProjectDialogOpen(true);
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
    setOpenMenuProjectId(null);
    togglePinMutation.mutate(projectId, {
      onError: () => toast.error('Failed to update pin'),
    });
  };

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
      <div className={cn('space-y-4 md:space-y-6 animate-fade-in w-full max-w-full min-w-0')}>
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
          <div className="space-y-4 min-w-0 w-full">
            <div className={cn(
              view === 'grid'
                ? 'grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 min-w-0 w-full'
                : 'space-y-3 min-w-0 w-full'
            )}>
              {paginatedProjects.map((project) => (
                <Link key={project.id} to={`/projects/${project.id}`} className="block h-full min-w-0 w-full">
                  <Card className={cn(
                    'rounded-2xl border-border/70 bg-gradient-to-b from-card to-card/80 card-hover cursor-pointer h-full flex flex-col min-w-0 w-full overflow-hidden',
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
                        <DropdownMenu
                          open={openMenuProjectId === project.id}
                          onOpenChange={(open) => setOpenMenuProjectId(open ? project.id : null)}
                        >
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
                              <>
                                <DropdownMenuItem onClick={(e) => handleEdit(project.id, e)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => handleRequestDelete(project.id, e)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
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
