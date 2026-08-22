import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, ArrowLeft, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authService } from "@/services/auth.service";

const MIN_PASSWORD_LENGTH = 8;

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token!, password);
      navigate("/login", {
        replace: true,
        state: {
          message: "Password reset! Please sign in.",
          email: "",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset password";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <Logo className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">OpenPlan AI</span>
            </div>
            <CardTitle className="text-2xl font-bold">Link Invalid or Expired</CardTitle>
            <CardDescription>
              This password reset link is no longer valid. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link to="/forgot-password">Request New Reset Link</Link>
            </Button>
            <Link
              to="/login"
              className="inline-flex items-center justify-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Logo className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">OpenPlan AI</span>
          </div>
          <CardTitle className="text-2xl font-bold">Set a new password</CardTitle>
          <CardDescription>Choose a strong password for your account.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  placeholder="Confirm your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Password must be at least {MIN_PASSWORD_LENGTH} characters
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || password.length < MIN_PASSWORD_LENGTH}
            >
              {isSubmitting ? "Updating password…" : "Update password"}
            </Button>
            <Link
              to="/login"
              className="inline-flex items-center justify-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ResetPassword;
