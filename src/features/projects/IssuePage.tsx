import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { IssueDetailContent } from './components/IssueDetailContent';
import { Issue } from '@/types';
import { useProjectDetail } from '@/hooks/useProjectDetail';
import { useIssue, useUpdateIssue, useDeleteIssue } from '@/hooks/useIssues';
import { useProjectMembers } from '@/hooks/useProjectTeam';
import { logger } from '@/services/monitoring/logger';

export default function IssuePage() {
  const { projectId, issueId } = useParams();
  const navigate = useNavigate();

  const {
    data: project,
    isLoading: isProjectLoading,
    error: projectError
  } = useProjectDetail(projectId);

  const {
    data: directIssue,
    isLoading: isIssueLoading,
    error: issueError
  } = useIssue(issueId);

  const { data: teamMembers = [], isLoading: isTeamLoading } = useProjectMembers(projectId);
  const updateIssueMutation = useUpdateIssue();
  const deleteIssueMutation = useDeleteIssue();

  // Find issue in project data as a fallback
  const projectIssue = project?.issues?.find(i => i.id === issueId);
  const issue = directIssue || projectIssue;

  const isLoading = isProjectLoading || (isIssueLoading && !projectIssue) || isTeamLoading;
  const hasError = !!projectError || (!!issueError && !projectIssue);

  if (isLoading) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-80" />
          <p className="text-muted-foreground animate-pulse">Loading issue details...</p>
        </div>
      </>
    );
  }

  if (hasError || !project || !issue) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-[60vh] max-w-md mx-auto text-center px-4">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mb-6">
            <ArrowLeft className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {hasError ? 'Error loading issue' : 'Issue not found'}
          </h2>
          <p className="text-muted-foreground mt-3 text-balance">
            {hasError
              ? 'There was a problem fetching the issue data. Please check your connection or try again.'
              : !project
                ? 'The project associated with this issue could not be found.'
                : 'The specific issue you are looking for does not exist or has been removed.'}
          </p>
          <div className="flex gap-4 mt-8">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
            <Button variant="default" className="px-8" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </div>
        </div>
      </>
    );
  }

  const handleUpdate = async (updatedIssue: Issue) => {
    try {
      await updateIssueMutation.mutateAsync({
        projectId: project.id,
        issueId: updatedIssue.id,
        updates: updatedIssue,
      });
      navigate(`/projects/${projectId}?tab=issues`);
    } catch (error) {
      logger.error('Failed to update issue:', error);
    }
  };

  const handleDelete = async (issueId: string) => {
    try {
      await deleteIssueMutation.mutateAsync({
        projectId: project.id,
        issueId,
      });
      navigate(`/projects/${projectId}?tab=issues`);
    } catch (error) {
      logger.error('Failed to delete issue:', error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex items-center gap-3 pb-4 mb-6 border-b">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          title="Back to Project"
          onClick={() => navigate(`/projects/${projectId}?tab=issues`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          <span className="font-medium text-foreground truncate max-w-[220px]">{project.name}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-muted-foreground">Issues</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-foreground truncate max-w-[320px]" title={issue.title}>
            {issue.title}
          </span>
        </div>
      </div>

      <div className="bg-background text-foreground rounded-xl border shadow-sm p-6 sm:p-8">
        <IssueDetailContent
          issue={issue}
          tasks={project.tasks}
          teamMembers={teamMembers}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          userProjectRole={project.myRole}
          isExpanded={true}
        />
      </div>
    </div>
  );
}
