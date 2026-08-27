import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { apiClient } from '@/services/api/client';
import { teamService } from '@/services/team.service';
import {
  normalizeInviteEmail,
  inviteMatchesAnyEmail,
  candidateEmailsFromAuthUser,
} from '@/utils/inviteEmail';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Building2, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function JoinOrganization() {
  const [searchParams] = useSearchParams();
  const inviteParam = searchParams.get('invite');
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { refreshOrganizations } = useOrganization();

  const [invitation, setInvitation] = useState<any>(null);
  const [orgName, setOrgName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const inviteEmailMismatch = useMemo(() => {
    if (!invitation?.email || !user) return false;
    const candidates = candidateEmailsFromAuthUser(user).filter((e): e is string => Boolean(e));
    if (candidates.length === 0) return false;
    return !inviteMatchesAnyEmail(invitation.email, candidates);
  }, [invitation, user]);

  const signedInEmailHint = useMemo(() => {
    if (!user) return '';
    return normalizeInviteEmail(user.email) || 'this account';
  }, [user]);

  useEffect(() => {
    if (!inviteParam) {
      setError('No invitation identifier provided.');
      setLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      try {
        const data = await apiClient.get<any>(`/invitations/lookup?invite=${encodeURIComponent(inviteParam)}`);
        setInvitation(data);
        setOrgName(data?.organizationName || data?.organization?.name || 'the organization');
      } catch (err: any) {
        setError(err?.message || 'This invitation is invalid or has already been used.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [inviteParam]);

  const handleAccept = async () => {
    if (!inviteParam) return;
    setAccepting(true);
    try {
      await teamService.acceptInvitation(inviteParam);
      localStorage.removeItem('pending_invite_token');
      await refreshOrganizations();
      setSuccess(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setAccepting(false);
    }
  };

  const handleSwitchAccount = async () => {
    try {
      await signOut();
    } catch {
      /* still navigate — stale session is confusing */
    }
    const redirect = `/join-org?invite=${encodeURIComponent(inviteParam || '')}`;
    navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Join Organization</CardTitle>
          <CardDescription>
            {error
              ? 'Something went wrong'
              : success
              ? 'Welcome aboard!'
              : `You've been invited to join ${orgName}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Link to="/login">
                <Button variant="outline">Go to Login</Button>
              </Link>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle className="h-10 w-10 text-primary" />
              <p className="text-sm text-muted-foreground">You've joined {orgName}. Redirecting...</p>
            </div>
          ) : !user ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                You've been invited to join <strong>{orgName}</strong> as a <strong>{invitation?.role || 'member'}</strong>.
                Sign in or create an account to accept.
              </p>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Link to={`/signup?invite=${inviteParam}`} className="w-full sm:w-auto">
                  <Button className="w-full">Create Account</Button>
                </Link>
                <Link
                  to={`/login?redirect=${encodeURIComponent(`/join-org?invite=${inviteParam}`)}`}
                  className="w-full sm:w-auto"
                >
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
              </div>
              {invitation?.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Invitation expires {format(new Date(invitation.expiresAt), "dd- MMM yyyy")}
                </p>
              )}
            </div>
          ) : inviteEmailMismatch ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-600" />
              <p className="text-sm text-muted-foreground">
                This invitation was sent to{' '}
                <strong className="text-foreground">{normalizeInviteEmail(invitation?.email)}</strong>.
                You are signed in as <strong className="text-foreground">{signedInEmailHint}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Use the account that received the email, or ask an admin to send a new invite to your
                current address.
              </p>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Button type="button" variant="default" className="w-full sm:w-auto" onClick={handleSwitchAccount}>
                  Switch account
                </Button>
                <Link to="/" className="w-full sm:w-auto">
                  <Button type="button" variant="outline" className="w-full">
                    Go to dashboard
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                You'll join <strong>{orgName}</strong> as a <strong>{invitation?.role || 'member'}</strong>.
              </p>
              <Button onClick={handleAccept} disabled={accepting} className="w-full">
                {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Accept & Join Organization
              </Button>
              {invitation?.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Invitation expires {format(new Date(invitation.expiresAt), "dd- MMM yyyy")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
