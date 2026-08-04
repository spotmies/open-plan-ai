import { useState, useMemo, useRef, useEffect } from 'react';
import { Users, Trash2, Loader2, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOrganizationMembers, useProjectMembers } from '@/hooks/useProjectTeam';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { projectMembersService } from '@/services/projectMembers.service';
import { chatService } from '@/services/chat.service';
import { toast } from 'sonner';
import { ProjectRole } from '@/types';
import { logger } from '@/services/monitoring/logger';
import { resolveFileUrl } from '@/utils/fileUrl';

const toProjectRole = (role: string | undefined | null): ProjectRole => {
  const normalized = (role || '').toLowerCase();
  if (normalized === 'admin' || normalized === 'maintainer') return normalized;
  return 'member';
};

const DEFAULT_MEMBER_REMOVAL_PROMPT: {
  open: boolean;
  memberId: string | null;
  memberName: string;
} = {
  open: false,
  memberId: null,
  memberName: '',
};

interface ProjectTeamButtonProps {
  projectId: string;
}

export function ProjectTeamButton({ projectId }: ProjectTeamButtonProps) {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();

  const { data: organizationMembers = [] } = useOrganizationMembers(currentOrganization?.id);
  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const { canManageMembers } = useProjectPermissions(projectId);

  const canManageProjectMembers = canManageMembers;

  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState('');
  const [selectedMemberRoleToAdd, setSelectedMemberRoleToAdd] = useState<ProjectRole>('member');
  const [isAddingProjectMember, setIsAddingProjectMember] = useState(false);
  const [isAddMemberPopoverOpen, setIsAddMemberPopoverOpen] = useState(false);
  const [memberRoleUpdatingId, setMemberRoleUpdatingId] = useState<string | null>(null);
  
  const [memberRemovalPrompt, setMemberRemovalPrompt] = useState(DEFAULT_MEMBER_REMOVAL_PROMPT);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  const availableOrganizationMembers = useMemo(() => {
    const projectMemberIds = new Set(projectMembers.map((member) => member.id));
    return organizationMembers.filter((member) => !projectMemberIds.has(member.id));
  }, [organizationMembers, projectMembers]);

  const selectedMemberToAddDetails = useMemo(
    () => availableOrganizationMembers.find((member) => member.id === selectedMemberToAdd),
    [availableOrganizationMembers, selectedMemberToAdd]
  );

  const handleAddProjectMember = async () => {
    if (!projectId || !selectedMemberToAdd) return;
    if (!canManageProjectMembers) {
      toast.error('Only a project Admin can add or remove members');
      return;
    }

    const isMemberAlreadyInProject = projectMembers.some((m) => m.id === selectedMemberToAdd);
    if (isMemberAlreadyInProject) {
      toast.error('Member is already in this project');
      return;
    }

    const isMemberInOrganization = availableOrganizationMembers.some(
      (m) => m.id === selectedMemberToAdd
    );
    if (!isMemberInOrganization) {
      toast.error('Selected member is no longer available');
      return;
    }

    setIsAddingProjectMember(true);
    try {
      await projectMembersService.addMember({
        project_id: projectId,
        user_id: selectedMemberToAdd,
        role: selectedMemberRoleToAdd,
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(currentOrganization?.id) });
      await queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });

      toast.success('Member added to project');
      setSelectedMemberToAdd('');
      setSelectedMemberRoleToAdd('member');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add member to project';
      toast.error(message);
    } finally {
      setIsAddingProjectMember(false);
    }
  };

  const handleUpdateProjectMemberRole = async (memberId: string, role: ProjectRole) => {
    if (!projectId || !canManageProjectMembers) return;

    setMemberRoleUpdatingId(memberId);
    try {
      await projectMembersService.updateRole(projectId, memberId, role);
      await queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast.success('Member role updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update member role';
      toast.error(message);
    } finally {
      setMemberRoleUpdatingId(null);
    }
  };

  const handleRemoveProjectMember = async (removeFromChatToo: boolean) => {
    if (!projectId || !memberRemovalPrompt.memberId) return;
    if (!canManageProjectMembers) {
      toast.error('Only a project Admin can add or remove members');
      return;
    }

    const isValidUuidLike = (value: unknown): value is string => {
      if (typeof value !== 'string') return false;
      return (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
        /^[0-9a-f]{32}$/i.test(value)
      );
    };

    const memberId = memberRemovalPrompt.memberId;
    if (!isValidUuidLike(projectId) || !isValidUuidLike(memberId)) {
      toast.error('Invalid member selection');
      return;
    }
    const isMemberInProject = projectMembers.some((m) => m.id === memberId);
    if (!isMemberInProject) {
      toast.error('That member is not part of this project anymore');
      return;
    }

    setIsRemovingMember(true);
    try {
      if (!removeFromChatToo) {
        await chatService.retainProjectChatMembershipAfterRemoval(projectId, [memberId]);
      }

      await projectMembersService.removeMember(projectId, memberId);

      if (removeFromChatToo) {
        try {
          const conversationId = await chatService.getProjectGroupConversationId(projectId);
          if (conversationId) {
            await chatService.forceRemoveProjectChatMembers(projectId, [memberId]);
          }
        } catch (chatErr) {
          logger.warn('[ProjectDetail] chat cleanup failed during member removal', {
            projectId: projectId,
            memberId,
            error: chatErr instanceof Error ? chatErr.message : String(chatErr),
          });
          toast.warning(
            'Member removed from project, but could not update project group chat',
            { description: chatErr instanceof Error ? chatErr.message : undefined }
          );
        }
      }

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(currentOrganization?.id) }),
        queryClient.invalidateQueries({ queryKey: ['project-members', projectId] }),
      ]);

      toast.success('Member removed from project');
      setMemberRemovalPrompt(DEFAULT_MEMBER_REMOVAL_PROMPT);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      toast.error(message);
    } finally {
      setIsRemovingMember(false);
    }
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer rounded-md border border-border px-2 py-1 sm:py-1.5 text-foreground hover:bg-muted transition-colors h-8 sm:h-9"
          >
            <Users className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 text-muted-foreground" />
            {/* <span className="text-[11px] sm:text-xs font-medium">Team</span> */}
            {/* <span className="text-[11px] sm:text-xs text-muted-foreground">{projectMembers.length}</span> */}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-2">
            <p className="text-sm font-medium">Project Team</p>
            {projectMembers.length > 0 ? (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {projectMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={resolveFileUrl(member.avatar) ?? member.avatar} alt={member.name} />
                        <AvatarFallback className="text-[11px]">
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{member.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canManageProjectMembers ? (
                        <Select
                          value={toProjectRole(member.role)}
                          onValueChange={(v) => handleUpdateProjectMemberRole(member.id, v as ProjectRole)}
                          disabled={memberRoleUpdatingId === member.id}
                        >
                          <SelectTrigger className="h-7 w-[100px] text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="maintainer">Maintainer</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="text-[10px] max-w-[120px] truncate">
                          {member.role || 'Member'}
                        </Badge>
                      )}
                      {canManageProjectMembers && member.role?.toLowerCase() !== 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            const memberId = member.id;
                            const memberName = typeof member.name === 'string' ? member.name : '';
                            if (!memberId) return;
                            setMemberRemovalPrompt({ open: true, memberId, memberName });
                          }}
                          title="Remove member"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No team members assigned yet.</p>
            )}
            {canManageProjectMembers ? (
              <div className="pt-3 mt-2 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Add Member</p>
                <div className="space-y-2">
                  <Popover open={isAddMemberPopoverOpen} onOpenChange={setIsAddMemberPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={availableOrganizationMembers.length === 0}
                        className={cn(
                          'w-full h-8 flex items-center gap-2 px-3 rounded-md border border-input bg-background text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                        )}
                      >
                        {selectedMemberToAddDetails ? (
                          <>
                            <Avatar className="h-5 w-5 shrink-0">
                              <AvatarImage
                                src={resolveFileUrl(selectedMemberToAddDetails.avatar) ?? selectedMemberToAddDetails.avatar}
                                alt={selectedMemberToAddDetails.name}
                              />
                              <AvatarFallback className="text-[9px]">
                                {selectedMemberToAddDetails.initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 text-left truncate">{selectedMemberToAddDetails.name}</span>
                          </>
                        ) : (
                          <span className="flex-1 text-left text-muted-foreground">
                            {availableOrganizationMembers.length > 0
                              ? 'Select organization member'
                              : 'No members available to add'}
                          </span>
                        )}
                        <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[260px]" align="start">
                      <Command>
                        <CommandInput placeholder="Search organization members..." />
                        <CommandList>
                          <CommandEmpty>No members found.</CommandEmpty>
                          <CommandGroup>
                            {availableOrganizationMembers.map((member) => (
                              <CommandItem
                                key={member.id}
                                value={`${member.id} ${member.name}`}
                                onSelect={() => {
                                  setSelectedMemberToAdd(member.id);
                                  setIsAddMemberPopoverOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={resolveFileUrl(member.avatar) ?? member.avatar} alt={member.name} />
                                    <AvatarFallback className="text-[9px]">{member.initials}</AvatarFallback>
                                  </Avatar>
                                  {member.name}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Select value={selectedMemberRoleToAdd} onValueChange={(v) => setSelectedMemberRoleToAdd(v as ProjectRole)}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select project role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="maintainer">Maintainer</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleAddProjectMember}
                    disabled={isAddingProjectMember || !selectedMemberToAdd || availableOrganizationMembers.length === 0}
                  >
                    {isAddingProjectMember && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Member
                  </Button>
                  {availableOrganizationMembers.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      All organization members are already in this project.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="pt-3 mt-2 border-t">
                <p className="text-[11px] text-muted-foreground">
                  Only a project Admin can add or remove project members.
                </p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={memberRemovalPrompt.open} onOpenChange={(open) => {
        if (!open) setMemberRemovalPrompt(DEFAULT_MEMBER_REMOVAL_PROMPT);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Project Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{memberRemovalPrompt.memberName}</strong> from this project?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setMemberRemovalPrompt(DEFAULT_MEMBER_REMOVAL_PROMPT)}
              disabled={isRemovingMember}
            >
              Cancel
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="destructive"
                onClick={() => handleRemoveProjectMember(false)}
                disabled={isRemovingMember}
                className="flex-1"
              >
                {isRemovingMember && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleRemoveProjectMember(true)}
                disabled={isRemovingMember}
                className="flex-1"
              >
                {isRemovingMember && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove & Kick from Chat
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
