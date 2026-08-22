import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Building, Loader2 } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { organizationsService } from '@/services/organizations.service';
import { toast } from 'sonner';
import type { TeamMember } from '@/services/team.service';
import { logger } from '@/services/monitoring/logger';

interface ManageOrgAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  currentUserId?: string;
}

interface MemberOrgInfo {
  organization_id: string;
  role: string;
}

export function ManageOrgAccessDialog({
  open,
  onOpenChange,
  member,
  currentUserId,
}: ManageOrgAccessDialogProps) {
  const { organizations } = useOrganization();
  const [memberOrgs, setMemberOrgs] = useState<MemberOrgInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [togglingOrg, setTogglingOrg] = useState<string | null>(null);

  useEffect(() => {
    if (open && member) {
      fetchMemberOrgs();
    }
  }, [open, member?.userId]);

  const fetchMemberOrgs = async () => {
    if (!member) return;
    setIsLoading(true);
    try {
      const orgs = await organizationsService.getMemberOrganizations(member.userId);
      setMemberOrgs(orgs);
    } catch (err) {
      logger.error('Failed to fetch member organizations:', err);
      toast.error('Failed to load organization access');
    } finally {
      setIsLoading(false);
    }
  };

  const isMemberOfOrg = (orgId: string) =>
    memberOrgs.some(mo => mo.organization_id === orgId);

  const handleToggle = async (orgId: string, currentlyMember: boolean) => {
    if (!member) return;

    // Prevent removing self
    if (member.userId === currentUserId && currentlyMember) {
      toast.error('You cannot remove yourself from an organization');
      return;
    }

    // Prevent removing from last org
    if (currentlyMember && memberOrgs.length <= 1) {
      toast.error('Cannot remove from the last organization');
      return;
    }

    setTogglingOrg(orgId);
    try {
      if (currentlyMember) {
        await organizationsService.removeMember(orgId, member.userId);
        setMemberOrgs(prev => prev.filter(mo => mo.organization_id !== orgId));
        toast.success('Access removed');
      } else {
        await organizationsService.addMember(orgId, member.userId, 'member');
        setMemberOrgs(prev => [...prev, { organization_id: orgId, role: 'member' }]);
        toast.success('Access granted');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update access');
    } finally {
      setTogglingOrg(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Organization Access</DialogTitle>
          <DialogDescription>
            Toggle which organizations{' '}
            <span className="font-medium text-foreground">{member?.name}</span>{' '}
            has access to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isLoading ? (
            <>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-14" />
              ))}
            </>
          ) : (
            organizations.map(org => {
              const hasAccess = isMemberOfOrg(org.id);
              const isToggling = togglingOrg === org.id;
              const isSelf = member?.id === currentUserId;
              const isLastOrg = hasAccess && memberOrgs.length <= 1;

              return (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Building className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{org.name}</p>
                      {hasAccess && (
                        <Badge variant="secondary" className="text-xs mt-0.5">
                          {memberOrgs.find(mo => mo.organization_id === org.id)?.role}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isToggling && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={hasAccess}
                      onCheckedChange={() => handleToggle(org.id, hasAccess)}
                      disabled={isToggling || (isSelf && hasAccess) || isLastOrg}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
