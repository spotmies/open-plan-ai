import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Upload, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { organizationsService, OrganizationSettings } from '@/services/organizations.service';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';
import { resolveFileUrl } from '@/utils/fileUrl';
import { logger } from '@/services/monitoring/logger';
import { SUPPORTED_CURRENCIES } from '@/hooks/useCurrency';
import { useOrgPermissions } from '@/hooks/useProjectPermissions';

const EditOrganizationSettings = () => {
  const navigate = useNavigate();
  const { currentOrganization, refreshOrganizations, isLoading: orgContextLoading } = useOrganization();
  const { myOrgRole: currentOrgRole, canManageOrgSettings: canEditOrganizationSettings } = useOrgPermissions();
  const roleLabel = currentOrgRole ? currentOrgRole.charAt(0).toUpperCase() + currentOrgRole.slice(1) : 'Member';

  const [orgForm, setOrgForm] = useState({
    name: '',
    description: '',
    companyName: '',
    companySize: '',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    logoUrl: '',
  });
  const [orgLoading, setOrgLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentOrganization) {
      const settings = (currentOrganization.settings || {}) as OrganizationSettings;
      setOrgForm(prev => ({
        ...prev,
        name: currentOrganization.name || '',
        description: currentOrganization.description || '',
        companyName: settings.companyName || '',
        companySize: settings.companySize || '',
        timezone: settings.timezone || 'America/New_York',
        dateFormat: settings.dateFormat || 'MM/DD/YYYY',
        currency: settings.currency || 'USD',
        logoUrl: resolveFileUrl(settings.logoUrl) ?? settings.logoUrl ?? prev.logoUrl,
      }));
    }
  }, [currentOrganization]);

  const handleLogoClick = () => {
    if (!canEditOrganizationSettings) return;
    logoInputRef.current?.click();
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditOrganizationSettings) {
      toast.error('Only admins and owners can change the organization logo');
      return;
    }

    if (!currentOrganization) return;

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      const localPreview = URL.createObjectURL(file);
      setOrgForm(prev => ({ ...prev, logoUrl: localPreview }));

      setLogoLoading(true);
      try {
        const logoUrl = await organizationsService.uploadLogo(currentOrganization.id, file);
        URL.revokeObjectURL(localPreview);
        setOrgForm(prev => ({ ...prev, logoUrl }));
        await refreshOrganizations();
        toast.success('Organization logo updated successfully');
      } catch (error) {
        URL.revokeObjectURL(localPreview);
        setOrgForm(prev => ({ ...prev, logoUrl: '' }));
        logger.error('Error uploading logo:', error);
        toast.error('Failed to upload logo');
      } finally {
        setLogoLoading(false);
        if (logoInputRef.current) {
          logoInputRef.current.value = '';
        }
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!canEditOrganizationSettings) {
      toast.error('Only admins and owners can remove the organization logo');
      return;
    }

    if (!currentOrganization) return;

    setLogoLoading(true);
    try {
      await organizationsService.deleteLogo(currentOrganization.id);
      setOrgForm(prev => ({ ...prev, logoUrl: '' }));
      await refreshOrganizations();
      toast.success('Organization logo removed');
    } catch (error) {
      logger.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    } finally {
      setLogoLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canEditOrganizationSettings) {
      toast.error(`Access denied: ${roleLabel} role cannot edit organization settings. Contact an admin.`);
      return;
    }

    if (!currentOrganization) {
      toast.error('No organization selected');
      return;
    }

    if (!orgForm.name.trim()) {
      toast.error('Organization name is required');
      return;
    }

    setOrgLoading(true);
    try {
      await organizationsService.update(currentOrganization.id, {
        name: orgForm.name,
        description: orgForm.description || null,
        settings: {
          companyName: orgForm.companyName,
          companySize: orgForm.companySize,
          timezone: orgForm.timezone,
          dateFormat: orgForm.dateFormat,
          currency: orgForm.currency,
        },
      });

      await refreshOrganizations();
      toast.success('Workspace settings saved');
      navigate('/settings?tab=general');
    } catch (error) {
      logger.error('Error saving workspace settings:', error);
      const maybe = error as { code?: string; message?: string; details?: string };
      const isPermissionLikeError =
        maybe?.code === 'PGRST116' ||
        (typeof maybe?.message === 'string' &&
          (maybe.message.includes('0 rows') || maybe.message.toLowerCase().includes('not acceptable'))) ||
        (typeof maybe?.details === 'string' && maybe.details.includes('0 rows'));

      if (isPermissionLikeError) {
        toast.error(`Access denied: ${roleLabel} role cannot update organization settings.`);
      } else {
        toast.error('Failed to save workspace settings');
      }
    } finally {
      setOrgLoading(false);
    }
  };

  if (orgContextLoading) {
    return <AppLayoutSkeleton variant="detail" />;
  }

  if (!currentOrganization) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-xl font-medium">No workspace selected</h2>
        <Button className="mt-4" onClick={() => navigate('/settings?tab=general')}>
          Back to Settings
        </Button>
      </div>
    );
  }

  if (!canEditOrganizationSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-xl font-medium">Access denied</h2>
        <p className="text-muted-foreground mt-2">
          Only organization admins and owners can edit these settings.
        </p>
        <Button className="mt-4" onClick={() => navigate('/settings?tab=general')}>
          Back to Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings?tab=general')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-foreground truncate">Edit Organization Settings</h1>
            <p className="text-muted-foreground text-sm truncate">{currentOrganization.name}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => navigate('/settings?tab=general')}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={orgLoading}>
            {orgLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>
            Configure your organization preferences and defaults
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Organization Logo */}
          <div className="space-y-2">
            <Label>Organization Logo</Label>
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                {logoLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : orgForm.logoUrl ? (
                  <img
                    src={resolveFileUrl(orgForm.logoUrl) ?? orgForm.logoUrl}
                    alt="Organization logo"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">No logo</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <input
                  type="file"
                  ref={logoInputRef}
                  className="hidden"
                  accept="image/png, image/jpeg, image/gif, image/svg+xml"
                  onChange={handleLogoChange}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleLogoClick} disabled={logoLoading}>
                    <Upload className="h-4 w-4 mr-2" />
                    {orgForm.logoUrl ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                  {orgForm.logoUrl && (
                    <Button variant="outline" size="sm" onClick={handleRemoveLogo} disabled={logoLoading}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, GIF or SVG. Max 5MB. Recommended size: 200x200px.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="workspace-name">Organization Name</Label>
            <Input
              id="workspace-name"
              value={orgForm.name}
              onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-desc">Description</Label>
            <Textarea
              id="workspace-desc"
              value={orgForm.description}
              onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                placeholder="e.g. Acme Corp"
                value={orgForm.companyName}
                onChange={(e) => setOrgForm({ ...orgForm, companyName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-size">Company Size</Label>
              <Select
                value={orgForm.companySize}
                onValueChange={(value) => setOrgForm({ ...orgForm, companySize: value })}
              >
                <SelectTrigger id="company-size">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="10-50">10-50 employees</SelectItem>
                  <SelectItem value="50-200">50-200 employees</SelectItem>
                  <SelectItem value="200-500">200-500 employees</SelectItem>
                  <SelectItem value="500+">500+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={orgForm.timezone}
                onValueChange={(value) => setOrgForm({ ...orgForm, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="Europe/London">Greenwich Mean Time (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                  <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select
                value={orgForm.dateFormat}
                onValueChange={(value) => setOrgForm({ ...orgForm, dateFormat: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={orgForm.currency}
                onValueChange={(value) => setOrgForm({ ...orgForm, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditOrganizationSettings;
