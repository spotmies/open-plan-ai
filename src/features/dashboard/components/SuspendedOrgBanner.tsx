import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, AlertTriangle, Building2, Mail, RefreshCw, ArrowRight } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useNavigate } from 'react-router-dom';

interface SuspendedOrgBannerProps {
  onOpenCreateDialog?: () => void;
}

export function SuspendedOrgBanner({ onOpenCreateDialog }: SuspendedOrgBannerProps) {
  const { currentOrganization, organizations, setCurrentOrganization, refreshOrganizations } = useOrganization();
  const navigate = useNavigate();

  if (!currentOrganization || currentOrganization.status !== 'suspended') {
    return null;
  }

  // "Switch to another organization" must only offer orgs that actually work —
  // a pending or rejected one is just as closed as the suspended one they are
  // trying to escape.
  const otherOrgs = organizations.filter(
    (o) => o.id !== currentOrganization.id && o.status === 'active',
  );

  return (
    <div className="w-full space-y-4 my-2">
      <Card className="border-destructive/40 bg-gradient-to-br from-destructive/10 via-destructive/5 to-background shadow-md overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-destructive/15 text-destructive ring-8 ring-destructive/10 shrink-0">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    {currentOrganization.name}
                  </h2>
                  <Badge variant="destructive" className="font-semibold text-xs uppercase tracking-wider px-2 py-0.5">
                    Suspended
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground max-w-2xl">
                  Access to this organization has been temporarily suspended by the platform administrator.
                  All workspace operations, projects, and active data pipelines are currently locked.
                </p>

                {currentOrganization.suspendedReason && (
                  <div className="mt-3 p-3 rounded-lg bg-background/80 border border-destructive/20 text-xs text-foreground/90 max-w-2xl flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-destructive">Reason: </span>
                      <span>{currentOrganization.suspendedReason}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
              <Button
                variant="default"
                size="sm"
                className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm"
                onClick={() => window.open('mailto:support@openplanai.com?subject=Inquiry%20regarding%20suspended%20organization:%20' + encodeURIComponent(currentOrganization.name), '_blank')}
              >
                <Mail className="h-4 w-4" />
                Contact Administrator / Support
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => refreshOrganizations()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Check Status Again
              </Button>
            </div>
          </div>

          {/* Alternative Organizations */}
          {otherOrgs.length > 0 && (
            <div className="mt-6 pt-6 border-t border-destructive/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                You have access to <span className="font-semibold text-foreground">{otherOrgs.length} other active {otherOrgs.length === 1 ? 'organization' : 'organizations'}</span>:
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {otherOrgs.slice(0, 3).map((org) => (
                  <Button
                    key={org.id}
                    variant="secondary"
                    size="sm"
                    className="text-xs h-7 gap-1.5"
                    onClick={() => setCurrentOrganization(org)}
                  >
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    {org.name}
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
