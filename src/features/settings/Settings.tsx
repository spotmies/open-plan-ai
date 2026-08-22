import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserSettings } from '@/types';
import { defaultPreferences as defaultUserSettings } from '@/stores/useUserStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Palette,
  Save,
  Upload,
  ShieldAlert,
  Trash2,
  Lock,
  Loader2,
  Building2,
  Check,
  Monitor,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Pencil,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { profileService } from '@/services/profile.service';
import { notificationPreferencesService, NotificationPreferences } from '@/services/notificationPreferences.service';
import { organizationsService, OrganizationSettings } from '@/services/organizations.service';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useUserStore } from '@/stores/useUserStore';
import { getPasswordRequirements } from '@/lib/passwordValidation';
import { resolveFileUrl } from '@/utils/fileUrl';
import { cn } from '@/lib/utils';
import { logger } from '@/services/monitoring/logger';
import { SUPPORTED_CURRENCIES } from '@/hooks/useCurrency';
import { useOrgPermissions } from '@/hooks/useProjectPermissions';

const COMPANY_SIZE_LABELS: Record<string, string> = {
  '1-10': '1-10 employees',
  '10-50': '10-50 employees',
  '50-200': '50-200 employees',
  '200-500': '200-500 employees',
  '500+': '500+ employees',
};

const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern Time (ET)',
  'America/Chicago': 'Central Time (CT)',
  'America/Denver': 'Mountain Time (MT)',
  'America/Los_Angeles': 'Pacific Time (PT)',
  'Europe/London': 'Greenwich Mean Time (GMT)',
  'Europe/Paris': 'Central European Time (CET)',
  'Asia/Kolkata': 'India Standard Time (IST)',
};

type ThemePreference = 'light' | 'dark' | 'system';

function normalizeTheme(value: unknown): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}


const Settings = () => {
  useEffect(() => {
    document.title = 'Settings | Open Plan AI';
    return () => { document.title = 'Open Plan AI'; };
  }, []);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshProfile, updatePassword, deleteAccount, signOut } = useAuth();
  const profile = user;
  const { currentOrganization, createOrganization, refreshOrganizations, isLoading: orgContextLoading } = useOrganization();
  const { canManageOrgSettings: canEditOrganizationSettings } = useOrgPermissions();
  const { theme, changeTheme } = useAppTheme();
  const preferences = useUserStore((s) => s.preferences);
  const updatePreferences = useUserStore((s) => s.updatePreferences);

  // Local state for Appearance tab so changes only apply on Save
  const [tempTheme, setTempTheme] = useState<ThemePreference>(normalizeTheme(theme));
  const [tempPreferences, setTempPreferences] = useState(preferences);

  // Sync local appearance state when global state loads/changes remotely
  useEffect(() => {
    setTempTheme(normalizeTheme(theme));
    setTempPreferences(preferences);
  }, [theme, preferences]);

  // Notification preferences (fetched from the backend)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    defaultUserSettings.notifications,
  );
  const [notificationPrefsLoading, setNotificationPrefsLoading] = useState(false);
  const [notificationPrefsSaving, setNotificationPrefsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNotificationPrefsLoading(true);
    notificationPreferencesService
      .getPreferences()
      .then((prefs) => {
        if (!cancelled) setNotificationPrefs(prefs);
      })
      .catch((error) => {
        logger.error('Error loading notification preferences:', error);
      })
      .finally(() => {
        if (!cancelled) setNotificationPrefsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSaveNotificationPreferences = async () => {
    setNotificationPrefsSaving(true);
    try {
      const saved = await notificationPreferencesService.updatePreferences(notificationPrefs);
      setNotificationPrefs(saved);
      toast.success('Notification preferences saved');
    } catch (error) {
      logger.error('Error saving notification preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setNotificationPrefsSaving(false);
    }
  };


  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    initials: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // Organization form state
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
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarRemoval, setPendingAvatarRemoval] = useState(false);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // New organization creation state
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newOrgForm, setNewOrgForm] = useState({
    name: '',
    description: '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const validTabs = ['general', 'profile', 'notifications', 'appearance', 'danger'] as const;
  type SettingsTab = typeof validTabs[number];
  const getTabFromParams = (): SettingsTab => {
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab as SettingsTab)) {
      return tab as SettingsTab;
    }
    return 'general';
  };
  const [activeTab, setActiveTab] = useState<SettingsTab>(getTabFromParams);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync profile data to form
  useEffect(() => {
    if (profile) {
      setProfileForm({
        name: profile.name || '',
        initials: profile.initials || '',
      });
    }
  }, [profile]);

  // Discard any unsaved avatar preview when leaving the page
  const localAvatarPreviewRef = useRef<string | null>(null);
  localAvatarPreviewRef.current = localAvatarPreview;
  useEffect(() => {
    return () => {
      if (localAvatarPreviewRef.current) {
        URL.revokeObjectURL(localAvatarPreviewRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setActiveTab(getTabFromParams());
  }, [searchParams]);

  // Discard any unsaved avatar/name edits when leaving the Profile tab
  useEffect(() => {
    if (activeTab !== 'profile') {
      if (localAvatarPreviewRef.current) {
        URL.revokeObjectURL(localAvatarPreviewRef.current);
      }
      setPendingAvatarFile(null);
      setPendingAvatarRemoval(false);
      setLocalAvatarPreview(null);
      setIsEditingProfile(false);
      if (profile) {
        setProfileForm({
          name: profile.name || '',
          initials: profile.initials || '',
        });
      }
    }
  }, [activeTab, profile]);

  // Sync organization data to form - preserve local logoUrl if server hasn't updated yet
  const resetOrgFormFromOrganization = () => {
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
  };

  useEffect(() => {
    resetOrgFormFromOrganization();
  }, [currentOrganization]);


  const handleCreateOrganization = async () => {
    if (!newOrgForm.name.trim()) {
      toast.error('Workspace name is required');
      return;
    }

    setIsCreatingOrg(true);
    try {
      await createOrganization(newOrgForm.name, newOrgForm.description);
      toast.success('Workspace created successfully');
      setNewOrgForm({ name: '', description: '' });
    } catch (error) {
      logger.error('Error creating workspace:', error);
      toast.error('Failed to create workspace');
    } finally {
      setIsCreatingOrg(false);
    }
  };

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

  const handleSaveOrganization = async () => {
    if (!canEditOrganizationSettings) {
      toast.error('Only organization admins and owners can edit these settings.');
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
      setIsEditingOrg(false);
    } catch (error) {
      logger.error('Error saving workspace settings:', error);
      toast.error('Failed to save workspace settings');
    } finally {
      setOrgLoading(false);
    }
  };

  const handleCancelEditOrganization = () => {
    resetOrgFormFromOrganization();
    setIsEditingOrg(false);
  };

  const hasProfileChanges =
    profileForm.name !== (profile?.name || '') ||
    profileForm.initials !== (profile?.initials || '') ||
    pendingAvatarFile !== null ||
    pendingAvatarRemoval;

  const handleSaveProfile = async () => {
    if (!hasProfileChanges) {
      return;
    }

    setProfileLoading(true);
    try {
      if (pendingAvatarFile) {
        await profileService.uploadAvatar(pendingAvatarFile);
      } else if (pendingAvatarRemoval) {
        await profileService.deleteAvatar();
      }
      await profileService.updateProfile({
        name: profileForm.name,
        initials: profileForm.initials,
      });
      await refreshProfile();
      if (localAvatarPreview) {
        URL.revokeObjectURL(localAvatarPreview);
      }
      setPendingAvatarFile(null);
      setPendingAvatarRemoval(false);
      setLocalAvatarPreview(null);
      setIsEditingProfile(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      logger.error('Error saving profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveAvatar = () => {
    if (localAvatarPreview) {
      URL.revokeObjectURL(localAvatarPreview);
    }

    setPendingAvatarFile(null);
    setLocalAvatarPreview(null);
    setPendingAvatarRemoval(true);
    setIsEditingProfile(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      // Only preview locally — actual upload happens when Save Profile is clicked
      if (localAvatarPreview) {
        URL.revokeObjectURL(localAvatarPreview);
      }
      const localPreview = URL.createObjectURL(file);
      setLocalAvatarPreview(localPreview);
      setPendingAvatarFile(file);
      setPendingAvatarRemoval(false);
      setIsEditingProfile(true);
    }
    e.target.value = '';
  };

  const handleUpdatePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Enforce the same strong password policy as the signup page.
    const requirements = getPasswordRequirements(passwordForm.newPassword);
    const unmet = requirements.filter(r => !r.met);
    if (unmet.length > 0) {
      toast.error(`Password too weak: ${unmet.map(r => r.label).join(', ')}`);
      return;
    }

    setPasswordLoading(true);
    try {
      if (!passwordForm.currentPassword) {
        toast.error('Please enter your current password');
        setPasswordLoading(false);
        return;
      }
      const { error } = await updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password updated. Please sign in again.');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        // Backend revokes all refresh tokens on password change, but the current
        // access token cookie stays valid until it expires — sign out explicitly
        // so the user is forced to re-authenticate immediately.
        await signOut();
        navigate('/login');
      }
    } catch (error) {
      logger.error('Error updating password:', error);
      toast.error('Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSaveAppearance = () => {
    changeTheme(tempTheme);
    updatePreferences(tempPreferences);
    toast.success('Appearance preferences saved');
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const { error } = await deleteAccount();
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Account deleted');
        navigate('/login');
      }
    } catch (error) {
      logger.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Unify the shimmer loading state across the whole page to prevent blinking
  if (orgContextLoading) {
    return <AppLayoutSkeleton variant="settings" />;
  }

  return (
    <>
      <div className="space-y-6">
      
        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const selected = validTabs.includes(value as SettingsTab) ? (value as SettingsTab) : 'general';
            setActiveTab(selected);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set('tab', selected);
              return next;
            }, { replace: true });
          }}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="general" className="gap-1 px-0 sm:px-3" title="General">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-1 px-0 sm:px-3" title="Profile">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1 px-0 sm:px-3" title="Notifications">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1 px-0 sm:px-3" title="Appearance">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="danger" className="gap-1 px-0 sm:px-3 text-destructive data-[state=active]:text-destructive" title="Danger Zone">
              <ShieldAlert className="h-4 w-4" />
              <span className="hidden sm:inline">Danger</span>
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Organization Settings</CardTitle>
                  <CardDescription>
                    Configure your organization preferences and defaults
                  </CardDescription>
                </div>
                {currentOrganization && canEditOrganizationSettings && !isEditingOrg && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingOrg(true)} className="shrink-0">
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {!currentOrganization ? (
                  /* Create Workspace Form */
                  <div className="space-y-6">
                    <div className="text-center py-6">
                      <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Building2 className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Welcome! Let's set up your workspace
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Create a workspace to organize your projects, invite team members, and start collaborating.
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-4 max-w-md mx-auto">
                      <div className="space-y-2">
                        <Label htmlFor="new-workspace-name">Organization Name *</Label>
                        <Input
                          id="new-workspace-name"
                          value={newOrgForm.name}
                          onChange={(e) => setNewOrgForm({ ...newOrgForm, name: e.target.value })}
                          placeholder="e.g. My Company"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-workspace-desc">Description (optional)</Label>
                        <Textarea
                          id="new-workspace-desc"
                          value={newOrgForm.description}
                          onChange={(e) => setNewOrgForm({ ...newOrgForm, description: e.target.value })}
                          placeholder="Brief description of your workspace"
                          rows={3}
                        />
                      </div>
                      <Button
                        onClick={handleCreateOrganization}
                        disabled={isCreatingOrg || !newOrgForm.name.trim()}
                        className="w-full"
                      >
                        {isCreatingOrg ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Building2 className="h-4 w-4 mr-2" />
                        )}
                        Create Workspace
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Existing Workspace Settings (editable inline) */
                  <>
                    {!canEditOrganizationSettings && (
                      <div className="rounded-md border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                        You have view-only access. Only organization admins and owners can edit these settings.
                      </div>
                    )}

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
                        {canEditOrganizationSettings && isEditingOrg && (
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
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        value={orgForm.name}
                        disabled={!canEditOrganizationSettings || !isEditingOrg}
                        onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-desc">Description</Label>
                      <Textarea
                        id="org-desc"
                        value={orgForm.description}
                        disabled={!canEditOrganizationSettings || !isEditingOrg}
                        onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="org-company-name">Company Name</Label>
                        <Input
                          id="org-company-name"
                          placeholder="e.g. Acme Corp"
                          value={orgForm.companyName}
                          disabled={!canEditOrganizationSettings || !isEditingOrg}
                          onChange={(e) => setOrgForm({ ...orgForm, companyName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="org-company-size">Company Size</Label>
                        <Select
                          value={orgForm.companySize}
                          disabled={!canEditOrganizationSettings || !isEditingOrg}
                          onValueChange={(value) => setOrgForm({ ...orgForm, companySize: value })}
                        >
                          <SelectTrigger id="org-company-size">
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(COMPANY_SIZE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Timezone</Label>
                        <Select
                          value={orgForm.timezone}
                          disabled={!canEditOrganizationSettings || !isEditingOrg}
                          onValueChange={(value) => setOrgForm({ ...orgForm, timezone: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TIMEZONE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Date Format</Label>
                        <Select
                          value={orgForm.dateFormat}
                          disabled={!canEditOrganizationSettings || !isEditingOrg}
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
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select
                          value={orgForm.currency}
                          disabled={!canEditOrganizationSettings || !isEditingOrg}
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

                    {canEditOrganizationSettings && isEditingOrg && (
                      <div className="flex gap-2">
                        <Button onClick={handleSaveOrganization} disabled={orgLoading}>
                          {orgLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={handleCancelEditOrganization} disabled={orgLoading}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information and avatar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6">
                    <Avatar
                      className={cn(
                        'h-20 w-20 shrink-0',
                        (localAvatarPreview || profile?.avatarUrl) && 'cursor-pointer'
                      )}
                      onClick={() => {
                        if (localAvatarPreview || (!pendingAvatarRemoval && profile?.avatarUrl)) {
                          setIsAvatarPreviewOpen(true);
                        }
                      }}
                    >
                      {avatarLoading && !localAvatarPreview && !pendingAvatarRemoval ? (
                        <AvatarFallback className="bg-primary/10">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </AvatarFallback>
                      ) : localAvatarPreview || (!pendingAvatarRemoval && profile?.avatarUrl) ? (
                        <AvatarImage
                          src={localAvatarPreview || (!pendingAvatarRemoval ? resolveFileUrl(profile?.avatarUrl) || '' : '')}
                          alt={profile?.name || 'Avatar'}
                        />
                      ) : (
                        <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                          {profileForm.initials || profile?.name?.slice(0, 2).toUpperCase() || 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="space-y-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                      accept="image/png, image/jpeg, image/webp"
                        onChange={handleAvatarChange}
                      />
                      <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                        <Button variant="outline" size="sm" onClick={handleAvatarClick} disabled={avatarLoading}>
                          <Upload className="h-4 w-4 mr-2" />
                          Change Avatar
                        </Button>
                        {(profile?.avatarUrl || localAvatarPreview || pendingAvatarRemoval) && (
                          <Button variant="outline" size="sm" onClick={handleRemoveAvatar} disabled={avatarLoading}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {pendingAvatarFile
                          ? 'Click Save Profile to apply your new picture.'
                          : pendingAvatarRemoval
                            ? 'Click Save Profile to remove your current picture.'
                            : 'JPG, PNG or GIF. Max 5MB.'}
                      </p>
                    </div>
                  </div>

                  <Dialog open={isAvatarPreviewOpen} onOpenChange={setIsAvatarPreviewOpen}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Profile Picture</DialogTitle>
                      </DialogHeader>
                      <div className="flex items-center justify-center py-2">
                        <img
                          src={localAvatarPreview || (!pendingAvatarRemoval ? resolveFileUrl(profile?.avatarUrl) || '' : '')}
                          alt={profile?.name || 'Avatar'}
                          className="max-h-[60vh] w-full rounded-md object-contain"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="full-name">Full Name</Label>
                        {!isEditingProfile && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setIsEditingProfile(true)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      {isEditingProfile ? (
                        <Input
                          id="full-name"
                          value={profileForm.name}
                          autoFocus
                          onChange={(e) => {
                            const name = e.target.value;
                            const initials = name
                              .split(' ')
                              .map(n => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2);
                            setProfileForm({ ...profileForm, name, initials });
                          }}
                        />
                      ) : (
                        <p
                          id="full-name"
                          className="min-h-10 w-full break-words rounded-md border border-input bg-muted px-3 py-2 text-sm"
                        >
                          {profileForm.name || '—'}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={profile?.email || ''}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={profileLoading || !hasProfileChanges}>
                    {profileLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Profile
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Email Notifications</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Task Assignments</Label>
                        <p className="text-sm text-muted-foreground">
                          When you're assigned to a task
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.taskAssignments}
                        disabled={notificationPrefsLoading}
                        onCheckedChange={(checked) =>
                          setNotificationPrefs((prev) => ({ ...prev, taskAssignments: checked }))
                        }
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Task Completions</Label>
                        <p className="text-sm text-muted-foreground">
                          When tasks you're following are completed
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.taskCompletions}
                        disabled={notificationPrefsLoading}
                        onCheckedChange={(checked) =>
                          setNotificationPrefs((prev) => ({ ...prev, taskCompletions: checked }))
                        }
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Comments & Mentions</Label>
                        <p className="text-sm text-muted-foreground">
                          When someone mentions you or comments on your tasks
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.comments}
                        disabled={notificationPrefsLoading}
                        onCheckedChange={(checked) =>
                          setNotificationPrefs((prev) => ({ ...prev, comments: checked }))
                        }
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Project Updates</Label>
                        <p className="text-sm text-muted-foreground">
                          Important updates to projects you're part of
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.projectUpdates}
                        disabled={notificationPrefsLoading}
                        onCheckedChange={(checked) =>
                          setNotificationPrefs((prev) => ({ ...prev, projectUpdates: checked }))
                        }
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Milestone Reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          Reminders for upcoming milestones
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.milestoneReminders}
                        disabled={notificationPrefsLoading}
                        onCheckedChange={(checked) =>
                          setNotificationPrefs((prev) => ({ ...prev, milestoneReminders: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Email Digest Frequency</Label>
                  <Select
                    value={notificationPrefs.emailDigest}
                    disabled={notificationPrefsLoading}
                    onValueChange={(value) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        emailDigest: value as NotificationPreferences['emailDigest'],
                      }))
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Receive a summary of activity in your workspace
                  </p>
                </div>
                <Button onClick={handleSaveNotificationPreferences} disabled={notificationPrefsSaving || notificationPrefsLoading}>
                  {notificationPrefsSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Appearance Settings</CardTitle>
                <CardDescription>
                  Customize how OpenPlan looks for you
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme Picker */}
                <div className="space-y-3">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {([
                      { id: 'light' as const, label: 'Light', icon: Sun },
                      { id: 'dark' as const, label: 'Dark', icon: Moon },
                      { id: 'system' as const, label: 'System', icon: Monitor },
                    ]).map(({ id, label, icon: Icon }) => {
                      const isActive = tempTheme === id;
                      return (
                        <button
                          key={id}
                          onClick={() => setTempTheme(id)}
                          className={`relative p-4 rounded-lg border-2 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-accent'
                            }`}
                        >
                          {isActive && (
                            <span className="absolute top-2 right-2 flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                          <div
                            className="h-12 rounded mb-3 flex items-center justify-center"
                            style={
                              id === 'light'
                                ? { backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }
                                : id === 'dark'
                                  ? { backgroundColor: '#0f172a' }
                                  : { background: 'linear-gradient(to right, #ffffff, #0f172a)', border: '1px solid #e2e8f0' }
                            }
                          >
                            <Icon
                              className="h-5 w-5"
                              style={{ color: id === 'light' ? '#1e293b' : '#f8fafc' }}
                            />
                          </div>
                          <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* Layout Preferences */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Sidebar Collapsed by Default</Label>
                      <p className="text-sm text-muted-foreground">
                        Start with a collapsed sidebar for more workspace
                      </p>
                    </div>
                    <Switch
                      checked={tempPreferences.sidebarCollapsed}
                      onCheckedChange={(checked) => setTempPreferences(prev => ({ ...prev, sidebarCollapsed: checked }))}
                    />
                  </div>
                </div>

                <Button onClick={handleSaveAppearance}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Appearance
                </Button>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="danger">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Reset Password</CardTitle>
                  <CardDescription>
                    Choose how you'd like to reset your password
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Option 1: Email-based reset */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div>
                      <h4 className="font-medium text-sm">Send Reset Link to Email</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Get a secure password reset link sent to your email address. Safe for resetting password on other devices.
                      </p>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        navigate('/forgot-password');
                      }}
                      className="w-full"
                    >
                      Send Reset Link
                    </Button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-muted"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  {/* Option 2: Direct update */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div>
                      <h4 className="font-medium text-sm">Update Password Directly</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Change your password immediately without leaving this page.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="current-password"
                            type={showCurrentPassword ? "text" : "password"}
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            placeholder="Enter current password"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                          >
                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <div className="relative">
                          <Input
                            id="new-password"
                            type={showNewPassword ? "text" : "password"}
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            placeholder="Enter new password"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                            title={showNewPassword ? 'Hide new password' : 'Show new password'}
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <div className="relative">
                          <Input
                            id="confirm-password"
                            type={showConfirmPassword ? "text" : "password"}
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            placeholder="Confirm new password"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                            title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleUpdatePassword}
                      disabled={passwordLoading || !passwordForm.newPassword || !passwordForm.confirmPassword}
                      className="w-full"
                    >
                      {passwordLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Lock className="h-4 w-4 mr-2" />
                      )}
                      Update Password
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-destructive">Delete Account</CardTitle>
                  <CardDescription>
                    Permanently delete your account and all of your content.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This action is irreversible. Please continue with caution.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={deleteLoading}>
                        {deleteLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your
                          account and remove your data from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Settings;
