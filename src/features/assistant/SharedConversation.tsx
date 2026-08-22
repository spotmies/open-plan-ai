import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Share2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/Logo';
import { queryKeys } from '@/lib/queryClient';
import { assistantService } from '@/services/assistant.service';
import { AssistantTranscript } from './components/AssistantTranscript';
import { resolveConversationScopeLabel, type AssistantProposal } from './assistantData';

// Standalone public page — deliberately outside GuestRoute/ProtectedRoute/
// AppLayoutOutlet (see App.tsx), so it builds its own minimal chrome rather
// than reusing app-shell components an anonymous visitor has no context
// for. Same "each public page owns its own container" pattern as
// modules/auth/components/Login.tsx.
export default function SharedConversation() {
  const { shareId } = useParams<{ shareId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.assistant.shared(shareId ?? ''),
    queryFn: () => assistantService.getSharedConversation(shareId as string),
    enabled: !!shareId,
    retry: false,
  });

  useEffect(() => {
    document.title = data?.title ? `${data.title} | Open Plan AI` : 'Shared conversation | Open Plan AI';
    return () => {
      document.title = 'Open Plan AI';
    };
  }, [data?.title]);

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Logo className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">OpenPlan AI</span>
      </header>

      {isLoading && (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pt-4 md:px-6">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-[70%] rounded-2xl" />
            <Skeleton className="h-10 w-[45%] rounded-2xl" />
            <Skeleton className="h-20 w-[80%] rounded-2xl" />
            <Skeleton className="h-12 w-[55%] rounded-2xl" />
          </div>
        </div>
      )}

      {!isLoading && (isError || !data) && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">This link is no longer available.</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            The conversation may have been unshared, or the link may be incorrect.
          </p>
        </div>
      )}

      {!isLoading && data && (
        <>
          <div className="mx-auto w-full max-w-3xl px-4 pt-4 md:px-6">
            <Alert>
              <Share2 className="h-4 w-4" />
              <AlertDescription>
                Read-only copy of a shared conversation
                {data.ownerName ? ` · shared by ${data.ownerName}` : ''} ·{' '}
                {resolveConversationScopeLabel(data.scope, data.projectName ?? undefined)}
              </AlertDescription>
            </Alert>
          </div>
          <AssistantTranscript
            messages={data.messages}
            streamingText=""
            isStreaming={false}
            toolStatus={[]}
            pendingQuestions={null}
            onAnswer={() => {}}
            isAnswering={false}
            readOnly
            proposalsByMessageId={(data.proposals ?? []).reduce<Record<string, AssistantProposal[]>>((acc, p) => {
              (acc[p.messageId] ??= []).push(p);
              return acc;
            }, {})}
          />
        </>
      )}
    </div>
  );
}
