import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ManageOrgAccessDialog } from './components/ManageOrgAccessDialog';
import { useTeamMembers, useInviteTeamMember, useRemoveTeamMember, usePendingInvitations, useCancelInvitation, useUpdateTeamMemberDetails, type TeamMember, type TeamInvitation } from '@/hooks/useTeam';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { chatService } from '@/services/chat.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { getFallbackTagColor } from '@/lib/tagColors';
import { softTint } from '@/features/dashboard/utils/colors';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Label } from '@/components/ui/label';
import {
  Search,
  UserPlus,
  MoreHorizontal,
  Mail,
  Edit,
  Trash2,
  Users,
  UserCheck,
  Clock,
  Building,
  XCircle,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const DEPARTMENTS = ['Engineering', 'Design', 'Management', 'Quality Assurance', 'Operations', 'Sales', 'Marketing', 'Support'];

const ASSIGNABLE_ROLES = ['admin', 'maintainer'] as const;

const MEMBERS_PAGE_SIZE = 10;

const formatUiDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return format(parsed, 'dd-MM-yyyy');
};
const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();

const Team = () => {
  useEffect(() => {
    document.title = 'Team | Open Plan AI';
    return () => { document.title = 'Open Plan AI'; };
  }, []);

  const { currentOrganization, isLoading: isOrgLoading } = useOrganization();
  const { data: teamMembers, isLoading: isTeamLoading, error } = useTeamMembers(currentOrganization?.id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const inviteMutation = useInviteTeamMember();
  const removeMutation = useRemoveTeamMember();
  const cancelInviteMutation = useCancelInvitation();
  const updateMemberMutation = useUpdateTeamMemberDetails();
  const [isStartingChat, setIsStartingChat] = useState<string | null>(null);

  const { data: pendingInvitations, refetch: refetchPendingInvitations } = usePendingInvitations(currentOrganization?.id || '');

  const normalizeRole = (role: string | undefined | null): string => {
    if (typeof role !== 'string') return '';
    return role.trim().toLowerCase();
  };

  const handleMessageClick = async (targetUserId: string) => {
    if (!targetUserId || targetUserId === user?.id) return;
    try {
      setIsStartingChat(targetUserId);
      const convId = await chatService.getOrCreateDM(targetUserId);
      navigate(`/chat/${convId}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start chat');
    } finally {
      setIsStartingChat(null);
    }
  };

  // Check if current user has management privileges
  const currentMember = teamMembers?.find(m => m.userId === user?.id || m.email === user?.email);
  const currentRole = normalizeRole(currentMember?.role);
  // Org membership management (invite/add/remove/change-role) is admin-only —
  // Maintainer has zero org-membership management power under the 2-tier model.
  const isOrgAdminUser = currentRole === 'admin';

  // Only Admin can manage org members at all — Maintainer has no elevated
  // management power over other members.
  const canManageMember = (member: TeamMember): boolean => {
    return currentRole === 'admin' && member.userId !== user?.id;
  };

  // Roles the current user is allowed to assign to others — always both
  // tiers when the current user is admin, since only admin can manage anyone.
  const assignableRoles = currentRole === 'admin' ? ASSIGNABLE_ROLES : [];

  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmailError, setInviteEmailError] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteDepartment, setInviteDepartment] = useState('');
  const [manageOrgMember, setManageOrgMember] = useState<TeamMember | null>(null);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const members = teamMembers || [];
  const invitations = pendingInvitations || [];
  const memberEmailSet = new Set(members.map((member) => normalizeEmail(member.email)).filter(Boolean));
  const visiblePendingInvitations = invitations.filter((inv) => !memberEmailSet.has(normalizeEmail(inv.email)));

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedMembers = filteredMembers.slice(
    (safeCurrentPage - 1) * MEMBERS_PAGE_SIZE,
    safeCurrentPage * MEMBERS_PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const stats = {
    total: members.length,
    active: members.filter((m) => m.status === 'active').length,
    pending: visiblePendingInvitations.length,
    departments: [...new Set(members.map((m) => m.department).filter(Boolean))].length,
  };

  const validateInviteEmail = (email: string): string => {
    if (!email) return 'Email address is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
    return '';
  };

  const handleInvite = async () => {
    const emailError = validateInviteEmail(inviteEmail);
    if (emailError) {
      setInviteEmailError(emailError);
      return;
    }
    if (!inviteRole) {
      toast.error('Please select a role');
      return;
    }
    if (!currentOrganization?.id) {
      toast.error('No organization selected');
      return;
    }

    try {
      const result = await inviteMutation.mutateAsync({
        email: inviteEmail,
        role: inviteRole,
        orgId: currentOrganization.id,
        department: inviteDepartment || undefined,
      });
      await refetchPendingInvitations();

      if (result.outcome === 'already_pending') {
        toast.info('Invitation is already pending for this email.');
        setIsInviteDialogOpen(false);
        return;
      }

      if (result.outcome === 'created_without_email') {
        toast.warning(
          result.message || 'Invitation was created, but email delivery could not be confirmed.'
        );
        setIsInviteDialogOpen(false);
        setInviteEmail('');
        setInviteEmailError('');
        setInviteRole('');
        setInviteDepartment('');
        return;
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
      setIsInviteDialogOpen(false);
      setInviteEmail('');
      setInviteEmailError('');
      setInviteRole('');
      setInviteDepartment('');
    } catch (err: any) {
      // err.message is already the most specific message (extracted by apiClient's extractApiError)
      const apiMessage = typeof err?.message === 'string' && err.message
        ? err.message
        : 'Failed to send invitation. Please try again.';

      const lower = apiMessage.toLowerCase();
      if (lower.includes('already a member')) {
        toast.info(`${inviteEmail} is already a member of this organization.`);
      } else if (lower.includes('already exists') || lower.includes('already pending') || lower.includes('conflict')) {
        toast.info(`Invitation already sent — a pending invitation already exists for ${inviteEmail}.`);
      } else {
        toast.error(apiMessage);
      }
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    if (!currentOrganization) return;
    try {
      await cancelInviteMutation.mutateAsync({ invitationId, orgId: currentOrganization.id });
      toast.success('Invitation cancelled');
    } catch (err) {
      toast.error('Failed to cancel invitation');
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!currentOrganization) return;
    if (!currentOrganization.id) {
      toast.error('No organization selected');
      return;
    }

    try {
      await removeMutation.mutateAsync({
        memberId,
        orgId: currentOrganization.id,
      });
      toast.success('Member removed');
    } catch (err) {
      toast.error('Failed to remove member');
    }
  };

  const handleOpenEdit = (member: TeamMember) => {
    setEditMember(member);
    setEditRole(member.role);
    setEditDepartment(member.department || '');
  };

  const handleSaveEdit = async () => {
    if (!editMember || !currentOrganization) return;
    try {
      await updateMemberMutation.mutateAsync({
        memberId: editMember.userId,
        orgId: currentOrganization.id,
        updates: { role: editRole, department: editDepartment || undefined },
      });
      toast.success('Member updated');
      setEditMember(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update member');
    }
  };

  const getStatusColor = (status: TeamMember['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'inactive':
        return 'bg-muted text-muted-foreground border-muted';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    }
  };

  const getRoleBadgeClass = (role: string) =>
    role === 'admin' ? 'border-purple-500/50 text-purple-600 bg-purple-500/10' :
    role === 'maintainer' ? 'border-blue-500/50 text-blue-600 bg-blue-500/10' :
    '';

  const getAvatarColor = (member: TeamMember) => getFallbackTagColor(member.userId || member.email || member.name);

  if (isOrgLoading || (currentOrganization?.id && isTeamLoading)) {
    return <AppLayoutSkeleton variant="team" />;
  }

  if (error) {
    return (
      <>
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Failed to load team members</h3>
          <p className="text-muted-foreground">Please try again later</p>
        </div>
      </>
    );
  }

  if (!currentMember) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          <div className="bg-card rounded-lg px-3.5 py-2.5 flex-1 min-w-[140px] border border-border flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: softTint(isMobile ? '#EA580C' : '#0F172A', 0.12) }}
            >
              <Users className="w-4 h-4" style={{ color: isMobile ? '#EA580C' : '#0F172A' }} />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold leading-tight truncate">{stats.total}</span>
              <span className="block text-[11px] text-muted-foreground truncate">Total Members</span>
            </span>
          </div>
          
          <div className="bg-card rounded-lg px-3.5 py-2.5 flex-1 min-w-[140px] border border-border flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: softTint('#16A34A', 0.12) }}
            >
              <UserCheck className="w-4 h-4" style={{ color: '#16A34A' }} />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold leading-tight truncate">{stats.active}</span>
              <span className="block text-[11px] text-muted-foreground truncate">Active</span>
            </span>
          </div>

          <div className="bg-card rounded-lg px-3.5 py-2.5 flex-1 min-w-[140px] border border-border flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: softTint('#D97706', 0.12) }}
            >
              <Clock className="w-4 h-4" style={{ color: '#D97706' }} />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold leading-tight truncate">{stats.pending}</span>
              <span className="block text-[11px] text-muted-foreground truncate">Pending</span>
            </span>
          </div>

          <div className="bg-card rounded-lg px-3.5 py-2.5 flex-1 min-w-[140px] border border-border flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: softTint('#2563EB', 0.12) }}
            >
              <Building className="w-4 h-4" style={{ color: '#2563EB' }} />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold leading-tight truncate">{stats.departments}</span>
              <span className="block text-[11px] text-muted-foreground truncate">Departments</span>
            </span>
          </div>
        </div>

        {/* Pending Invitations */}
        {isOrgAdminUser && visiblePendingInvitations.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Invitations ({visiblePendingInvitations.length})
              </h3>
              <div className="space-y-2">
                {visiblePendingInvitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-yellow-500/10 text-yellow-600 text-xs">
                          {inv.email.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited as {inv.role} • Expires on {formatUiDate(inv.expires_at)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvite(inv.id)}
                      disabled={cancelInviteMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters & Search */}
        <div className="flex flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 sm:w-80 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Name or Email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {isOrgAdminUser && (
            <Dialog open={isInviteDialogOpen} onOpenChange={(open) => { setIsInviteDialogOpen(open); if (!open) { setInviteEmail(''); setInviteEmailError(''); setInviteRole(''); setInviteDepartment(''); } }}>
              {isMobile ? (
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-xl shrink-0"
                  onClick={() => setIsInviteDialogOpen(true)}
                  title="Invite Member"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => setIsInviteDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              )}
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation email to join your workspace
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        if (inviteEmailError) setInviteEmailError('');
                      }}
                      className={inviteEmailError ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {inviteEmailError && (
                      <p className="text-xs text-destructive">{inviteEmailError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="maintainer">Maintainer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select value={inviteDepartment} onValueChange={setInviteDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="engineering">Engineering</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                        <SelectItem value="qa">Quality Assurance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Team Members */}
        {isMobile ? (
          <div className="space-y-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Members
            </h3>
            <div className="rounded-lg border divide-y divide-border overflow-hidden">
              {paginatedMembers.map((member) => {
                const avatarColor = getAvatarColor(member);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMember(member)}
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      {member.avatar_url && (
                        <AvatarImage src={member.avatar_url} alt={member.name} className="object-cover" />
                      )}
                      <AvatarFallback
                        className="font-medium text-xs"
                        style={{ backgroundColor: avatarColor, color: '#fff' }}
                      >
                        {member.initials || member.name?.slice(0, 2).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{member.name || member.email}</p>
                        <Badge variant="outline" className={`shrink-0 ${getRoleBadgeClass(member.role)}`}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.department || 'No department'}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" />
                        {member.email}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
            {filteredMembers.length > 0 && totalPages > 1 && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <p className="text-xs text-muted-foreground">
                  Page {safeCurrentPage} of {totalPages} ({filteredMembers.length} members)
                </p>
                <Pagination className="mx-0 w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (safeCurrentPage > 1) setCurrentPage(safeCurrentPage - 1);
                        }}
                        className={cn(safeCurrentPage <= 1 && 'pointer-events-none opacity-50')}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (safeCurrentPage < totalPages) setCurrentPage(safeCurrentPage + 1);
                        }}
                        className={cn(safeCurrentPage >= totalPages && 'pointer-events-none opacity-50')}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {member.avatar_url && (
                          <AvatarImage src={member.avatar_url} alt={member.name} className="object-cover" />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                          {member.initials || member.name?.slice(0, 2).toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{member.name || member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getRoleBadgeClass(member.role)}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(member.status)}>
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.department && (
                      <Badge variant="secondary">{member.department}</Badge>
                    )}
                    {!member.department && (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.joinedAt
                      ? new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {member.userId !== user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleMessageClick(member.userId)}
                          disabled={isStartingChat === member.userId}
                          title="Message"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      )}
                      {canManageMember(member) && member.userId !== user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(member)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setManageOrgMember(member)}>
                              <Building className="h-4 w-4 mr-2" />
                              Manage Organizations
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleRemove(member.userId)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredMembers.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {safeCurrentPage} of {totalPages} ({filteredMembers.length} members)
              </p>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (safeCurrentPage > 1) setCurrentPage(safeCurrentPage - 1);
                      }}
                      className={cn(safeCurrentPage <= 1 && 'pointer-events-none opacity-50')}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (safeCurrentPage < totalPages) setCurrentPage(safeCurrentPage + 1);
                      }}
                      className={cn(safeCurrentPage >= totalPages && 'pointer-events-none opacity-50')}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
        )}

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No members found</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Invite team members to get started'}
            </p>
          </div>
        )}
      </div >

      {/* Edit Member Dialog */}
      < Dialog open={!!editMember
      } onOpenChange={(open) => !open && setEditMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>Update member details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editMember?.email || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={editDepartment} onValueChange={setEditDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d} value={d.toLowerCase()}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editRole}
                onValueChange={setEditRole}
                disabled={editMember?.userId === user?.id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editMember?.userId === user?.id && (
                <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMemberMutation.isPending}>
              {updateMemberMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Mobile: Member Detail Sheet */}
      <Sheet open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl"
          onPointerDownOutside={() => setSelectedMember(null)}
          onInteractOutside={() => setSelectedMember(null)}
        >
          {selectedMember && (
            <div className="space-y-6 pt-2">
              <div className="flex flex-col items-center gap-3 text-center">
                <Avatar className="h-16 w-16">
                  {selectedMember.avatar_url && (
                    <AvatarImage src={selectedMember.avatar_url} alt={selectedMember.name} className="object-cover" />
                  )}
                  <AvatarFallback
                    className="text-lg font-medium"
                    style={{ backgroundColor: getAvatarColor(selectedMember), color: '#fff' }}
                  >
                    {selectedMember.initials || selectedMember.name?.slice(0, 2).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-base font-semibold">{selectedMember.name || selectedMember.email}</p>
                  <div className="mt-1 flex items-center justify-center gap-2">
                    <Badge variant="outline" className={getRoleBadgeClass(selectedMember.role)}>
                      {selectedMember.role.charAt(0).toUpperCase() + selectedMember.role.slice(1)}
                    </Badge>
                    <Badge variant="outline" className={getStatusColor(selectedMember.status)}>
                      {selectedMember.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-blue-500/10 p-2">
                    <Building className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="truncate text-sm font-medium">{selectedMember.department || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-primary/10 p-2">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="truncate text-sm font-medium">{selectedMember.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-yellow-500/10 p-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Joined</p>
                    <p className="truncate text-sm font-medium">{formatUiDate(selectedMember.joinedAt)}</p>
                  </div>
                </div>
              </div>

              {(selectedMember.userId !== user?.id || canManageMember(selectedMember)) && (
                <div className="flex flex-col gap-2">
                  {selectedMember.userId !== user?.id && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedMember(null);
                        handleMessageClick(selectedMember.userId);
                      }}
                      disabled={isStartingChat === selectedMember.userId}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                  )}
                  {canManageMember(selectedMember) && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const member = selectedMember;
                          setSelectedMember(null);
                          handleOpenEdit(member);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const member = selectedMember;
                          setSelectedMember(null);
                          setManageOrgMember(member);
                        }}
                      >
                        <Building className="h-4 w-4 mr-2" />
                        Manage Organizations
                      </Button>
                      <Button
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          const memberId = selectedMember.userId;
                          setSelectedMember(null);
                          handleRemove(memberId);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ManageOrgAccessDialog
        open={!!manageOrgMember}
        onOpenChange={(open) => !open && setManageOrgMember(null)}
        member={manageOrgMember}
        currentUserId={user?.id}
      />
    </>
  );
};

export default Team;
