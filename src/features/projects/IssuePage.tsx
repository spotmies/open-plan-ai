import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Minimize2 } from 'lucide-react';
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
    <>
      <div className="container max-w-5xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit -ml-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => navigate(`/projects/${projectId}?tab=issues`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Shrink"
              onClick={() => navigate(`/projects/${projectId}/issues/${issueId}`)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-hidden">
            <span className="truncate max-w-[200px]">{project.name}</span>
            <span className="opacity-40">/</span>
            <span>Issues</span>
            <span className="opacity-40">/</span>
            <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded tracking-wider uppercase text-muted-foreground/80">
              {issue.id.slice(0, 8)}
            </span>
          </div>
        </div>

        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-8 min-h-[80vh] ring-1 ring-border/50">
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
    </>
  );
}
