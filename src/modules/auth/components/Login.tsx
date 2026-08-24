import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { teamService } from "@/services/team.service";
import { authService } from "@/services/auth.service";
import { useAppTheme } from "@/hooks/useAppTheme";
import { OrgReviewNotice } from "./OrgReviewNotice";
import type { OrgReviewBlock } from "../orgReview";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signIn, isLoading: authLoading, pendingVerificationEmail } = useAuth();
  const { theme, changeTheme } = useAppTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  // Set when the organization is awaiting or was refused admin approval. Replaces
  // the whole form: there is nothing useful to do with these credentials yet.
  const [orgReview, setOrgReview] = useState<OrgReviewBlock | null>(null);

  // Priority: ?redirect= query param > location.state.from > "/"
  const redirectParam = searchParams.get("redirect");
  const from = redirectParam || (location.state as any)?.from?.pathname || "/";

  // Auto-redirect to verification if there's a pending verification email
  useEffect(() => {
    if (pendingVerificationEmail) {
      navigate("/verify-email", {
        state: {
          email: pendingVerificationEmail,
          fromLogin: true,
          message: "Please verify your email to access your account."
        }
      });
    }
  }, [pendingVerificationEmail, navigate]);

  useEffect(() => {
    const s = location.state as { message?: string; email?: string } | null | undefined;
    const hasMessage = typeof s?.message === "string" && s.message.length > 0;
    const hasEmail = typeof s?.email === "string" && s.email.trim().length > 0;
    if (!hasMessage && !hasEmail) return;
    if (hasMessage) setResetSuccessMessage(s!.message!);
    if (hasEmail) setEmail(s!.email!.trim());
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setOrgReview(null);

    const result = await signIn(email, password);

    if (result.orgReview) {
      // Stay on this page and explain. Every other branch below navigates away,
      // which is why isLoading has to be cleared explicitly here — otherwise the
      // submit button stays spinner-locked forever.
      setOrgReview(result.orgReview);
      setIsLoading(false);
      return;
    }

    if (result.error) {
      // Check if the error is "Email not confirmed" - redirect to verify page
      const errorMessage = result.error.message.toLowerCase();
      if (errorMessage.includes("email not confirmed") || errorMessage.includes("email_not_confirmed")) {
        await authService.sendOtp(email);
        try {
          sessionStorage.setItem(
            'openplan_pending_verify',
            JSON.stringify({ email })
          );
        } catch {
          // sessionStorage may be full or unavailable
        }
        navigate("/verify-email", {
          state: {
            email,
            fromLogin: true,
            message: "Please verify your email to continue. A new verification code has been sent."
          }
        });
        return;
      }

      setError(result.error.message);
      setIsLoading(false);
    } else if (result.requiresVerification) {
      try {
        sessionStorage.setItem(
          'openplan_pending_verify',
          JSON.stringify({ email: result.email || email })
        );
      } catch {
        // sessionStorage may be full or unavailable
      }
      navigate("/verify-email", {
        state: {
          email: result.email || email,
          fromLogin: true,
          message: "Please verify your email to continue."
        }
      });
    } else {
      try {
        const pendingInviteId = localStorage.getItem('pending_invite_id');
        const pendingInviteToken = localStorage.getItem('pending_invite_token');
        const inviteIdentifier = pendingInviteId || pendingInviteToken;

        if (inviteIdentifier) {
          await teamService.acceptInvitation(inviteIdentifier);
          localStorage.removeItem('pending_invite_id');
          localStorage.removeItem('pending_invite_token');
        }
      } catch (inviteAcceptError) {
        // Non-fatal: user still logs in and can accept manually from Dashboard banner.
        console.warn('Auto-accept invitation after login failed:', inviteAcceptError);
      }

      navigate(from, { replace: true });
    }
  };

  const cycleTheme = () => {
    changeTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="min-h-screen bg-background flex relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 h-9 w-9"
        onClick={cycleTheme}
        title={`Theme: ${theme} (click to toggle)`}
      >
        {theme === 'dark' ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background items-center justify-center p-12">
        <div className="max-w-md space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Logo className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold text-foreground">OpenPlan AI</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground leading-tight">
            Streamline your hardware product development
          </h1>
          <p className="text-lg text-muted-foreground">
            Track projects, manage dependencies, and ship products faster with AI-powered insights.
          </p>
          <div className="flex gap-4 pt-4">
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-primary">50%</span>
              <span className="text-sm text-muted-foreground">Faster delivery</span>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-primary">10k+</span>
              <span className="text-sm text-muted-foreground">Projects managed</span>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-primary">99.9%</span>
              <span className="text-sm text-muted-foreground">Uptime</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-0 sm:p-8 overflow-y-auto hide-scrollbar">
        <Card className="w-full max-w-md border-0 sm:border shadow-none sm:shadow-xl rounded-none sm:rounded-lg bg-transparent sm:bg-card">
          <CardHeader className="space-y-1 text-center px-6 pt-10 pb-4 sm:pt-6">
            <div className="flex items-center justify-center gap-2 lg:hidden mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <Logo className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">OpenPlan AI</span>
            </div>
            {!orgReview && (
              <>
                <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </>
            )}
          </CardHeader>

          {/* The credentials were correct — the organization simply is not open
              yet, so the form is replaced rather than annotated with an error. */}
          {orgReview ? (
            <CardContent className="px-6 pb-8">
              <OrgReviewNotice
                review={orgReview}
                onRetry={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                retrying={isLoading}
              />
              <Button
                variant="link"
                className="mt-2 w-full text-muted-foreground"
                onClick={() => {
                  setOrgReview(null);
                  setPassword("");
                }}
              >
                Use a different account
              </Button>
            </CardContent>
          ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3 px-6 pb-4">
              {resetSuccessMessage && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-500">
                    {resetSuccessMessage}
                  </AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Work Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="current-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 px-6 pb-10 sm:pb-6">
              <Button type="submit" className="w-full" disabled={isLoading || authLoading}>
                {isLoading ? (
                  "Signing in..."
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Create account
                </Link>
              </p>
            </CardFooter>
          </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Login;
