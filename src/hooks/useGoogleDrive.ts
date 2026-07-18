import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { googleDriveService } from '@/services/googleDrive.service';
import { toast } from 'sonner';

export function useGoogleDriveStatus(orgId: string | undefined) {
  return useQuery({
    queryKey: ['google-drive-status', orgId],
    queryFn: () => googleDriveService.getStatus(orgId!),
    enabled: !!orgId,
  });
}

export function useDisconnectGoogleDrive(orgId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => googleDriveService.disconnect(orgId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-drive-status', orgId] });
      toast.success('Disconnected from Google Drive');
    },
    onError: (error) => {
      toast.error('Failed to disconnect Google Drive', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });
}
