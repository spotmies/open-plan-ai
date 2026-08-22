import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot, REGEXP_ONLY_DIGITS } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Layers, Mail, AlertCircle, CheckCircle } from "lucide-react";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/contexts/AuthContext";

const VerifyEmail = () => {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = (location.state ?? {}) as {
    email?: string;
    fromLogin?: boolean;
    message?: string;
  };
  const locationEmail = locationState.email || searchParams.get('email') || "";
  const [persistedEmail, setPersistedEmail] = useState("");
  const email = (locationEmail || persistedEmail || "").trim();
  const fromLogin = locationState.fromLogin || false;
  const redirectMessage = locationState.message || "";

  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (locationEmail) {
      return;
    }

    try {
      const raw = sessionStorage.getItem('openplan_pending_verify');
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as { email?: unknown };
      if (typeof parsed.email === 'string' && parsed.email.trim()) {
        setPersistedEmail(parsed.email.trim());
      }
    } catch {
      // Ignore malformed or inaccessible session storage.
    }
  }, [locationEmail]);

  // Redirect if no email
  useEffect(() => {
    if (!email) {
      navigate("/signup");
    }
  }, [email, navigate]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = useCallback(async () => {
    if (otp.length !== 6) return;

    setIsLoading(true);
    setError(null);

    try {
      await authService.verifyOtp(email, otp);

      setSuccess(true);
      setOtp("");

      sessionStorage.removeItem('openplan_pending_verify');

      // Refresh auth context so isEmailVerified becomes true
      await refreshProfile();

      // If there's a pending invite, redirect to join-org to complete the flow
      const pendingInvite = localStorage.getItem('pending_invite_token');
      setTimeout(() => {
        if (pendingInvite) {
          localStorage.removeItem('pending_invite_token');
          navigate(`/join-org?invite=${encodeURIComponent(pendingInvite)}`);
        } else {
          navigate("/");
        }
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(message);
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  }, [email, otp, navigate, refreshProfile]);

  // Auto-submit when OTP reaches 6 digits — handleVerify is stable via useCallback.
  useEffect(() => {
    if (otp.length === 6) {
      handleVerify();
    }
  }, [otp, handleVerify]);

  const handleResend = async () => {
    setIsResending(true);
    setError(null);

    try {
      await authService.sendOtp(email);
      setCountdown(60); // 60 second cooldown
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resend code";
      setError(message);
    } finally {
      setIsResending(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Layers className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">OpenPlan AI</span>
          </div>
          <CardTitle className="text-2xl font-bold">
            {success ? "Email verified" : "Verify your email"}
          </CardTitle>
          {!success && (
            <>
              <CardDescription>
                {fromLogin
                  ? "Please verify your email to access your account"
                  : "We sent a 6-digit code to"}
              </CardDescription>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{email}</span>
              </div>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {redirectMessage && !error && !success && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700">
                {redirectMessage}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">
                Email verified successfully! Redirecting...
              </AlertDescription>
            </Alert>
          )}

          {!success && (
            <>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otp}
                  onChange={setOtp}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                onClick={handleVerify}
                disabled={otp.length !== 6 || isLoading}
                className="w-full"
              >
                {isLoading ? "Verifying..." : "Verify Email"}
              </Button>

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the code?
                </p>
                <Button
                  variant="ghost"
                  onClick={handleResend}
                  disabled={countdown > 0 || isResending}
                  className="text-primary"
                >
                  {isResending
                    ? "Sending..."
                    : countdown > 0
                      ? `Resend in ${countdown}s`
                      : "Resend code"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                The code expires in 10 minutes
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
