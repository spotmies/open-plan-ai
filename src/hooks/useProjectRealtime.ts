import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { chatTransport } from '@/features/chat/transport';
import { queryKeys } from '@/lib/queryClient';

const ECO_EVENTS = [
  'eco:created',
  'eco:updated',
  'eco:deleted',
  'eco:submitted',
  'eco:decision',
  'eco:released',
  'eco:verified',
  'eco:closed',
  'eco:held',
  'eco:resumed',
] as const;

const BOM_EVENTS = [
  'bom:node_created',
  'bom:node_updated',
  'bom:node_deleted',
  'bom:node_moved',
  'bom:part_updated',
  'bom:status_changed',
] as const;

const ISSUE_EVENTS = [
  'issue:created',
  'issue:updated',
  'issue:status_changed',
  'issue:deleted',
] as const;

/**
 * Joins the `project:{projectId}` socket room and invalidates the relevant
 * React Query caches when the backend emits BOM/ECO/Issue events into that
 * room, so changes from other tabs/users show up without a manual refresh.
 */
export function useProjectRealtime(projectId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;
    // Reuses the single app-wide socket owned by the chat transport (see
    // useNotifications.ts for the same pattern) rather than opening a second
    // connection just for project-room events.
    const socket = (chatTransport as unknown as { socket?: import('socket.io-client').Socket }).socket;
    if (!socket) return;

    const joinRoom = () => socket.emit('join-project', projectId);
    joinRoom();
    socket.on('connect', joinRoom);

    const invalidateEco = (payload?: { ecoId?: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ecos.listRoot(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ecos.stats(projectId) });
      if (payload?.ecoId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.ecos.detail(payload.ecoId) });
      }
    };

    const invalidateBom = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.tree(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.summary(projectId) });
    };

    // Mirrors the invalidation set used by useCreateIssue/useUpdateIssue/useDeleteIssue
    // in useIssues.ts, so other users' Issues tabs stay in sync the same way the
    // creator's own tab already does via its local mutation cache invalidation.
    const invalidateIssues = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.openCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all });
    };

    ECO_EVENTS.forEach((evt) => socket.on(evt, invalidateEco));
    BOM_EVENTS.forEach((evt) => socket.on(evt, invalidateBom));
    ISSUE_EVENTS.forEach((evt) => socket.on(evt, invalidateIssues));

    return () => {
      socket.emit('leave-project', projectId);
      socket.off('connect', joinRoom);
      ECO_EVENTS.forEach((evt) => socket.off(evt, invalidateEco));
      BOM_EVENTS.forEach((evt) => socket.off(evt, invalidateBom));
      ISSUE_EVENTS.forEach((evt) => socket.off(evt, invalidateIssues));
    };
  }, [projectId, queryClient]);
}
