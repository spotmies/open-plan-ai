import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandLogo, type LogoSpec } from './BrandLogo';
import { LOGO_PATHS } from './logoPaths';
import solidworksLogo from '@/assets/logos/solidworks.svg';
import altiumLogo from '@/assets/logos/altium.svg';
import fusion360Logo from '@/assets/logos/fusion360.svg';
import orcadLogo from '@/assets/logos/orcad.svg';
import arenaLogo from '@/assets/logos/arena-plm.svg';
import googleMeetLogo from '@/assets/logos/google-meet.svg';
import googleDriveLogo from '@/assets/logos/google-drive.svg';
import {
  Search,
  Clock,
  Network,
  Bot,
  ClipboardList,
  Boxes,
  ShieldCheck,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useGoogleMeetStore } from './stores/useGoogleMeetStore';
import { useGoogleMeetStatus } from './hooks/useGoogleMeetStatus';
import { googleMeetService } from '@/services/googleMeet.service';
import { googleDriveService } from '@/services/googleDrive.service';
import { useGoogleDriveStatus, useDisconnectGoogleDrive } from '@/hooks/useGoogleDrive';
import { googleSheetsService } from '@/services/googleSheets.service';
import { useGoogleSheetsOrgStatus, useDisconnectGoogleSheets } from '@/hooks/useGoogleSheets';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Integration {
  id: string;
  name: string;
  description: string;
  logo: LogoSpec;
  color: string;
}

interface Section {
  title: string;
  items: Integration[];
}

const SECTIONS: Section[] = [
  {
    title: 'Features',
    items: [
      {
        id: 'requirements',
        name: 'Requirements',
        description: 'Trace requirements through tasks, modules, and ECOs for full coverage.',
        logo: { kind: 'icon', icon: ClipboardList },
        color: '#2563EB',
      },
      {
        id: 'inventory',
        name: 'Inventory',
        description: 'Track on-hand stock, allocations, and shortages against your BOMs.',
        logo: { kind: 'icon', icon: Boxes },
        color: '#D97706',
      },
      {
        id: 'gate-reviews',
        name: 'Gate Reviews',
        description: 'Run structured design and program gate reviews with sign-off tracking.',
        logo: { kind: 'icon', icon: ShieldCheck },
        color: '#059669',
      },
    ],
  },
  {
    title: 'Core Integrations',
    items: [
      {
        id: 'solidworks',
        name: 'SolidWorks',
        description: 'Sync CAD assemblies, parts, and revisions from SolidWorks into your BOM.',
        logo: { kind: 'image', src: solidworksLogo, alt: 'SolidWorks' },
        color: '#ED1C24',
      },
      {
        id: 'altium',
        name: 'Altium Designer',
        description: 'Pull PCB designs, schematics, and component data from Altium Designer.',
        logo: { kind: 'image', src: altiumLogo, alt: 'Altium Designer' },
        color: '#0091DA',
      },
      {
        id: 'arena-plm',
        name: 'Arena PLM',
        description: 'Keep BOMs, ECOs, and item masters in sync with Arena PLM.',
        logo: { kind: 'image', src: arenaLogo, alt: 'Arena PLM' },
        color: '#40AA1D',
      },
      {
        id: 'kicad',
        name: 'KiCad',
        description: 'Import open-source PCB designs and component libraries from KiCad.',
        logo: { kind: 'svg', path: LOGO_PATHS.kicad },
        color: '#314CB0',
      },
      {
        id: 'orcad',
        name: 'OrCAD',
        description: 'Bring schematic capture and PCB layout data in from OrCAD.',
        logo: { kind: 'image', src: orcadLogo, alt: 'OrCAD' },
        color: '#E31837',
      },
      {
        id: 'fusion-360',
        name: 'Fusion 360',
        description: 'Link mechanical CAD models and BOMs straight from Fusion 360.',
        logo: { kind: 'image', src: fusion360Logo, alt: 'Fusion 360' },
        color: '#FF6B00',
      },
    ],
  },
  {
    title: 'Connectors',
    items: [
      {
        id: 'google-meet',
        name: 'Google Meet',
        description: 'Have the power to access scheduled and instant audio or video calls at your fingertips.',
        logo: { kind: 'image', src: googleMeetLogo, alt: 'Google Meet' },
        color: '#00897B',
      },
      {
        id: 'google-drive',
        name: 'Google Drive',
        description: "Store project files in your organization's own Google Drive instead of our servers.",
        logo: { kind: 'image', src: googleDriveLogo, alt: 'Google Drive' },
        color: '#0F9D58',
      },
      {
        id: 'mcp',
        name: 'MCP',
        description: 'Connect Model Context Protocol servers to bring external tools and data in.',
        logo: { kind: 'icon', icon: Network },
        color: '#7C3AED',
      },
      {
        id: 'google-sheets',
        name: 'Google Sheets',
        description: "Connect your Google account here, then link a spreadsheet from any project's BOM to sync with Pull/Push.",
        logo: { kind: 'svg', path: LOGO_PATHS.googleSheets },
        color: '#34A853',
      },
      {
        id: 'excel',
        name: 'Microsoft Excel',
        description: 'Import and export BOMs, reports, and trackers as native Excel workbooks.',
        logo: { kind: 'icon', icon: FileSpreadsheet },
        color: '#217346',
      },
      {
        id: 'jira',
        name: 'Jira',
        description: 'Link issues, epics, and sprints to projects, tasks, and ECOs.',
        logo: { kind: 'svg', path: LOGO_PATHS.jira },
        color: '#0052CC',
      },
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        description: "Bring OpenAI's GPT models into chat, automations, and document generation.",
        logo: { kind: 'icon', icon: Bot },
        color: '#74AA9C',
      },
      {
        id: 'github',
        name: 'GitHub',
        description: 'Link commits, branches, and pull requests to issues and ECOs automatically.',
        logo: { kind: 'svg', path: LOGO_PATHS.github },
        color: '#181717',
      },
      {
        id: 'claude',
        name: 'Claude',
        description: "Use Anthropic's Claude for AI-assisted planning, summaries, and task generation.",
        logo: { kind: 'svg', path: LOGO_PATHS.claude },
        color: '#D97757',
      },
      {
        id: 'google-docs',
        name: 'Google Docs',
        description: 'Generate and link requirement documents and specs straight from Google Docs.',
        logo: { kind: 'svg', path: LOGO_PATHS.googleDocs },
        color: '#4285F4',
      },
    ],
  },
];

export default function Integrations() {
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const isOrgAdmin = currentOrganization?.myRole === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();

  // Google Sheets connects once per org, same as Drive/Meet below — each
  // project then just links a spreadsheet from its own BOM, reusing this
  // connection (see BOMPartSheet.tsx's Sourcing tab).
  const { data: sheetsStatus, isLoading: isSheetsStatusLoading } = useGoogleSheetsOrgStatus(currentOrganization?.id);
  const disconnectSheets = useDisconnectGoogleSheets(currentOrganization?.id);
  const isSheetsConnected = !!sheetsStatus?.connected;

  const { data: driveStatus, isLoading: isDriveStatusLoading } = useGoogleDriveStatus(currentOrganization?.id);
  const disconnectDrive = useDisconnectGoogleDrive(currentOrganization?.id);
  const isDriveConnected = !!driveStatus?.connected;

  // Real (backend-persisted) status for the current user — single source of
  // truth across tabs/devices, unlike the old client-side sessionStorage flag
  // that only reflected whichever tab happened to run the OAuth popup.
  const { data: meetStatusMap } = useGoogleMeetStatus(user ? [user.id] : []);
  const isMeetConnected = !!(user && meetStatusMap?.[user.id]?.connected);
  const meetEmail = (user && meetStatusMap?.[user.id]?.email) || null;

  useEffect(() => {
    document.title = 'Integrations | Open Plan AI';
    return () => { document.title = 'Open Plan AI'; };
  }, []);

  // Handle the redirect back from the Google Drive OAuth callback
  // (?drive=connected | ?drive=error&reason=...) — show a toast, then strip
  // the query params so a page refresh doesn't re-trigger the message.
  useEffect(() => {
    const driveResult = searchParams.get('drive');
    if (!driveResult) return;

    if (driveResult === 'connected') {
      toast.success('Google Drive connected — new project files will save there.');
    } else if (driveResult === 'error') {
      const reason = searchParams.get('reason');
      toast.error(
        reason === 'cancelled' || reason === 'access_denied'
          ? 'Google Drive connection was cancelled.'
          : 'Failed to connect Google Drive. Please try again.',
      );
    }

    const next = new URLSearchParams(searchParams);
    next.delete('drive');
    next.delete('reason');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle the redirect back from the Google Sheets OAuth callback
  // (?sheets=connected | ?sheets=error&reason=...) — same pattern as Drive above.
  useEffect(() => {
    const sheetsResult = searchParams.get('sheets');
    if (!sheetsResult) return;

    if (sheetsResult === 'connected') {
      toast.success('Google Sheets connected — link a spreadsheet from any project\'s BOM to start syncing.');
    } else if (sheetsResult === 'error') {
      const reason = searchParams.get('reason');
      toast.error(
        reason === 'cancelled' || reason === 'access_denied'
          ? 'Google Sheets connection was cancelled.'
          : 'Failed to connect Google Sheets. Please try again.',
      );
    }

    const next = new URLSearchParams(searchParams);
    next.delete('sheets');
    next.delete('reason');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle the redirect back from the Google Meet OAuth callback
  // (?meet=connected | ?meet=error&reason=...) — same pattern as Drive above.
  // This is a full page redirect (Connect uses window.location.href), so the
  // component remounts fresh and useGoogleMeetStatus already refetches the
  // real backend status on its own — no manual query invalidation needed here.
  useEffect(() => {
    const meetResult = searchParams.get('meet');
    if (!meetResult) return;

    if (meetResult === 'connected') {
      toast.success('Google Meet connected — this will stay connected until you disconnect it.');
    } else if (meetResult === 'error') {
      const reason = searchParams.get('reason');
      toast.error(
        reason === 'cancelled' || reason === 'access_denied'
          ? 'Google Meet connection was cancelled.'
          : 'Failed to connect Google Meet. Please try again.',
      );
    }

    const next = new URLSearchParams(searchParams);
    next.delete('meet');
    next.delete('reason');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnectGoogleDrive = () => {
    if (!currentOrganization) {
      toast.error('Select an organization first.');
      return;
    }
    if (!isOrgAdmin) {
      toast.error('Only an organization admin can connect Google Drive.');
      return;
    }
    // Full page navigation (not a fetch) — the browser needs to follow the
    // redirect chain all the way to Google's consent screen and back.
    window.location.href = googleDriveService.getConnectUrl(currentOrganization.id);
  };

  const handleDisconnectGoogleDrive = () => {
    if (!isOrgAdmin) {
      toast.error('Only an organization admin can disconnect Google Drive.');
      return;
    }
    disconnectDrive.mutate();
  };

  const handleConnectGoogleMeet = () => {
    // Full page navigation (not a fetch) — same reasoning as Drive above: the
    // browser has to follow the redirect chain to Google's consent screen and
    // back to our callback route, which stores a permanent refresh token.
    window.location.href = googleMeetService.getConnectUrl();
  };

  const handleDisconnectGoogleMeet = async () => {
    // Clear any cached access token immediately so ensureFreshToken() can't
    // keep serving a stale one before the backend call below completes.
    useGoogleMeetStore.getState().disconnect();
    try {
      await googleMeetService.disconnect();
      queryClient.invalidateQueries({ queryKey: ['google-meet', 'status'] });
      toast.success('Disconnected from Google Meet integration');
    } catch {
      toast.error('Failed to disconnect Google Meet. Please try again.');
    }
  };

  const handleConnectGoogleSheets = () => {
    if (!currentOrganization) {
      toast.error('Select an organization first.');
      return;
    }
    if (!isOrgAdmin) {
      toast.error('Only an organization admin can connect Google Sheets.');
      return;
    }
    // Full page navigation (not a fetch) — same reasoning as Drive above.
    window.location.href = googleSheetsService.getConnectUrl(currentOrganization.id);
  };

  const handleDisconnectGoogleSheets = () => {
    if (!isOrgAdmin) {
      toast.error('Only an organization admin can disconnect Google Sheets.');
      return;
    }
    disconnectSheets.mutate();
  };

  const grouped = useMemo(() => {
    const query = search.trim().toLowerCase();
    return SECTIONS.map((section) => ({
      title: section.title,
      items: query
        ? section.items.filter((item) => item.name.toLowerCase().includes(query))
        : section.items,
    })).filter((section) => section.items.length > 0);
  }, [search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search integrations..."
          className="pl-9"
        />
      </div>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">No integrations match "{search}"</p>
        </div>
      ) : (
        grouped.map((section) => (
          <div key={section.title} className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">{section.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map((integration) => {
                const isGoogleMeet = integration.id === 'google-meet';
                const isGoogleDrive = integration.id === 'google-drive';
                const isGoogleSheets = integration.id === 'google-sheets';

                return (
                  <Card key={integration.id} className="relative overflow-hidden">
                    <CardContent className="p-5 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={
                            integration.logo.kind === 'image'
                              ? 'flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-white border border-border p-1.5'
                              : 'flex h-10 w-10 items-center justify-center rounded-lg shrink-0'
                          }
                          style={integration.logo.kind === 'image' ? undefined : { backgroundColor: `${integration.color}1A` }}
                        >
                          <BrandLogo
                            logo={integration.logo}
                            color={integration.color}
                            className={integration.logo.kind === 'image' ? 'h-full w-full' : 'h-5 w-5'}
                          />
                        </div>
                        {isGoogleMeet ? (
                          isMeetConnected ? (
                            <Badge variant="outline" className="gap-1 text-[11px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[11px]">
                              Available
                            </Badge>
                          )
                        ) : isGoogleDrive ? (
                          isDriveConnected ? (
                            <Badge variant="outline" className="gap-1 text-[11px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[11px]">
                              Available
                            </Badge>
                          )
                        ) : isGoogleSheets ? (
                          isSheetsConnected ? (
                            <Badge variant="outline" className="gap-1 text-[11px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[11px]">
                              Available
                            </Badge>
                          )
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-[11px]">
                            <Clock className="h-3 w-3" />
                            Coming soon
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium text-foreground mb-1">{integration.name}</h3>
                      <p className="text-sm text-muted-foreground flex-1">
                        {isGoogleMeet && isMeetConnected && meetEmail
                          ? `Connected as ${meetEmail}`
                          : isGoogleDrive && isDriveConnected && driveStatus?.email
                          ? `Connected as ${driveStatus.email}`
                          : isGoogleSheets && isSheetsConnected && sheetsStatus?.email
                          ? `Connected as ${sheetsStatus.email}`
                          : integration.description}
                      </p>

                      {isGoogleMeet ? (
                        isMeetConnected ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="mt-4 w-full"
                            onClick={handleDisconnectGoogleMeet}
                          >
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            className="mt-4 w-full"
                            onClick={handleConnectGoogleMeet}
                          >
                            Connect
                          </Button>
                        )
                      ) : isGoogleDrive ? (
                        isDriveConnected ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="mt-4 w-full"
                            onClick={handleDisconnectGoogleDrive}
                            disabled={!isOrgAdmin || disconnectDrive.isPending}
                            title={!isOrgAdmin ? 'Only an organization admin can disconnect Google Drive' : undefined}
                          >
                            {disconnectDrive.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            className="mt-4 w-full"
                            onClick={handleConnectGoogleDrive}
                            disabled={!isOrgAdmin || isDriveStatusLoading}
                            title={!isOrgAdmin ? 'Only an organization admin can connect Google Drive' : undefined}
                          >
                            Connect
                          </Button>
                        )
                      ) : isGoogleSheets ? (
                        isSheetsConnected ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="mt-4 w-full"
                            onClick={handleDisconnectGoogleSheets}
                            disabled={!isOrgAdmin || disconnectSheets.isPending}
                            title={!isOrgAdmin ? 'Only an organization admin can disconnect Google Sheets' : undefined}
                          >
                            {disconnectSheets.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            className="mt-4 w-full"
                            onClick={handleConnectGoogleSheets}
                            disabled={!isOrgAdmin || isSheetsStatusLoading}
                            title={!isOrgAdmin ? 'Only an organization admin can connect Google Sheets' : undefined}
                          >
                            Connect
                          </Button>
                        )
                      ) : (
                        <Button variant="outline" size="sm" className="mt-4 w-full" disabled>
                          Connect
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
