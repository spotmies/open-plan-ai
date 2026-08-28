import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  FileText,
  Flag,
  Layers,
  LayoutGrid,
  Link as LinkIcon,
  ListTodo,
  Loader2,
  Package,
  Paperclip,
  Pencil,
  Tag,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { FilePreviewDialog } from '@/components/FilePreviewDialog';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';
import { cn } from '@/lib/utils';
import { resolveFileUrl } from '@/utils/fileUrl';
import { logger } from '@/services/monitoring/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectDetail, useProjectModules } from '@/hooks/useProjectDetail';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { useProjectAttachments } from '@/hooks/useProjectAttachments';
import { useProjectLinks } from '@/hooks/useProjectLinks';
import { useDeleteProject } from '@/hooks/useProjects';
import {
  formatDepartmentLabel,
  formatDisplayDate,
  getAttachmentMimeType,
  isImageAttachment,
  stageLabels,
} from './utils/projectDisplay';

/** The attachment/link rows come back loosely shaped from two different APIs. */
type AttachmentLike = {
  id: string;
  url?: string;
  fileUrl?: string;
  file_name?: string;
  fileName?: string;
  name?: string;
  mimeType?: string;
  mime_type?: string;
};

type ProjectLinkLike = { id: string; title?: string; name?: string; url?: string };

/** Card shell — one visual language for every panel on the page. */
function Section({
  icon: Icon,
  title,
  action,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Full-page project record — reachable from the workspace header and from the
 * projects list. A page rather than a dialog so it can be linked to, opened in
 * a new tab and read without covering the workspace behind it.
 */
export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Fall back to the workspace when this page was opened directly (new tab,
  // refresh, shared link) and there's nothing in history to go back to.
  const handleBack = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(`/projects/${id}`);
    }
  };
  const [previewFile, setPreviewFile] = useState<AttachmentLike | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const deleteProjectMutation = useDeleteProject();

  const { data: project, isLoading } = useProjectDetail(id);
  const { data: team = [], isLoading: isLoadingTeam } = useProjectMembers(id);
  const { data: modules = [] } = useProjectModules(id);
  const { data: attachments = [] } = useProjectAttachments(id);
  const { data: links = [] } = useProjectLinks(id);

  // Everything this page shows except Stage is behind an Admin-only endpoint
  // (`PUT /projects/:id`), so Edit is Admin-or-creator — the same rule the
  // projects list applies to its own Edit action.
  const { isProjectAdmin } = useProjectPermissions(id);
  const canEdit = isProjectAdmin || (!!project && !!user?.id && project.createdBy === user.id);

  if (isLoading) return <AppLayoutSkeleton variant="detail" />;

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle className="mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Project not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been deleted, or you no longer have access to it.
        </p>
        <Button className="mt-4" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const handleDeleteProject = async () => {
    if (deleteConfirmText.trim() !== project.name) {
      toast.error('Project name does not match.');
      return;
    }
    try {
      await deleteProjectMutation.mutateAsync(project.id);
      toast.success('Project deleted successfully');
      navigate('/projects');
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

  const stageKey = project.stage as keyof typeof stageLabels;
  const workspaceStats = [
    { label: 'Tasks', value: project.tasks?.length ?? 0, icon: ListTodo, tab: 'tasks', alert: false },
    { label: 'Modules', value: modules.length, icon: Package, tab: 'modules', alert: false },
    { label: 'Milestones', value: project.milestones?.length ?? 0, icon: Flag, tab: 'milestones', alert: false },
    {
      label: 'Issues',
      value: project.issues?.filter((i) => i.status !== 'resolved' && i.status !== 'wont-fix').length ?? 0,
      icon: AlertTriangle,
      tab: 'issues',
      alert: true,
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-6 pb-10">
      {/* ── Page header ── the app header above already carries back, project
          name and stage badge for every /projects/:id route, so this row names
          the page instead of repeating the project and leaving the actions
          floating on an otherwise empty line. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0"
            onClick={handleBack}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Project Details</h1>
            <p className="text-sm text-muted-foreground">Scope, timeline, team and workspace at a glance</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/projects/${id}`)}>
            <LayoutGrid className="h-4 w-4" />
            Open Workspace
          </Button>
          {canEdit && (
            <Button className="gap-2" onClick={() => navigate(`/projects/${id}/edit`, { state: { from: 'details' } })}>
              <Pencil className="h-4 w-4" />
              Edit Project
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete Project
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Main column ── */}
        <div className="space-y-6 lg:col-span-2">
          <Section icon={FileText} title="Description">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {project.description || 'No description added yet.'}
            </p>
          </Section>

          <Section icon={Target} title="Progress & Timeline">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">{project.progress || 0}%</span>
            </div>
            <Progress value={project.progress || 0} className="h-2" />

            <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Start Date</dt>
                <dd className="mt-0.5 text-sm font-medium">{formatDisplayDate(project.startDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Target Date</dt>
                <dd className="mt-0.5 text-sm font-medium">{formatDisplayDate(project.targetDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Updated</dt>
                <dd className="mt-0.5 text-sm font-medium">{formatDisplayDate(project.updatedAt)}</dd>
              </div>
            </dl>
          </Section>

          <Section icon={Users} title={`Team Members (${team.length})`}>
            {isLoadingTeam ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : team.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {team.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={member.avatar || undefined} alt={member.name} referrerPolicy="no-referrer" />
                      <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.name}</p>
                      {member.role && (
                        <p className="truncate text-xs capitalize text-muted-foreground">
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
          </Section>

          <Section
            icon={LayoutGrid}
            title="Workspace"
            action={
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Tasks, issues, milestones &amp; modules
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {workspaceStats.map(({ label, value, icon: Icon, tab, alert }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => navigate(`/projects/${id}/${tab}`)}
                  className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/40"
                >
                  <Icon className={cn('h-4 w-4', alert && value > 0 ? 'text-destructive' : 'text-muted-foreground')} />
                  <p className={cn('mt-2 text-xl font-bold', alert && value > 0 && 'text-destructive')}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </button>
              ))}
            </div>
          </Section>

          {attachments.length > 0 && (
            <Section icon={Paperclip} title={`Attachments (${attachments.length})`}>
              <div className="space-y-2">
                {(attachments as AttachmentLike[]).map((attachment) => {
                  const attachmentName =
                    attachment.file_name || attachment.fileName || attachment.name || 'Untitled file';
                  const rawUrl = attachment.url || attachment.fileUrl;
                  const previewUrl = resolveFileUrl(rawUrl) ?? rawUrl;
                  return (
                    <button
                      key={attachment.id}
                      type="button"
                      disabled={!previewUrl}
                      onClick={() => previewUrl && setPreviewFile(attachment)}
                      className="flex w-full items-center gap-2 rounded-md bg-muted/50 p-2 text-left transition-colors hover:bg-muted disabled:cursor-default"
                    >
                      {previewUrl && isImageAttachment(attachment) ? (
                        <img src={previewUrl} alt={attachmentName} className="h-8 w-8 shrink-0 rounded object-cover" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate text-sm">{attachmentName}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {links.length > 0 && (
            <Section icon={LinkIcon} title={`Project Links (${links.length})`}>
              <div className="space-y-2">
                {(links as ProjectLinkLike[]).map((link) => (
                  <div key={link.id} className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
                    <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm">{link.title || link.name}</span>
                    {link.url && (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-[200px] truncate text-xs text-primary hover:underline"
                      >
                        {link.url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">
          <Section icon={Tag} title="Type & Stage">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Project Type</p>
                <p className="mt-0.5 text-sm font-medium">{project.type || 'Not set'}</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Layers className="h-3 w-3" />
                  Project Stage
                </p>
                <p className="mt-0.5 text-sm font-medium">{stageLabels[stageKey] || project.stage || 'Not set'}</p>
              </div>
            </div>
          </Section>

          <Section icon={Building2} title="Department">
            {project.departments && project.departments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {project.departments.map((deptId) => (
                  <Badge key={deptId} variant="outline" className="text-xs font-normal">
                    {formatDepartmentLabel(deptId)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No departments assigned.</p>
            )}
          </Section>

          {project.milestones && project.milestones.length > 0 && (
            <Section icon={Flag} title={`Milestones (${project.milestones.length})`}>
              <div className="space-y-2">
                {project.milestones.slice(0, 5).map((milestone) => (
                  <div key={milestone.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        milestone.completed ? 'bg-green-500' : 'bg-muted-foreground',
                      )}
                    />
                    <span className={cn('truncate', milestone.completed && 'text-muted-foreground line-through')}>
                      {milestone.title}
                    </span>
                  </div>
                ))}
                {project.milestones.length > 5 && (
                  <p className="text-xs text-muted-foreground">+{project.milestones.length - 5} more</p>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>

      {previewFile && (() => {
        const rawUrl = previewFile.url || previewFile.fileUrl;
        const url = resolveFileUrl(rawUrl) ?? rawUrl;
        if (!url) return null;
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

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteConfirmText('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              To confirm deletion, type <strong>{project.name}</strong> below. This permanently deletes the project
              and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-project-confirmation">Project Name</Label>
            <Input
              id="delete-project-confirmation"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={project.name}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deleteProjectMutation.isPending || deleteConfirmText.trim() !== project.name}
            >
              {deleteProjectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Permanently'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
