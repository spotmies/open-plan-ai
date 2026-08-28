import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, UserPlus } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ForgotPassword = () => {
  const { resetPassword } = useAuth();
  const location = useLocation();
  const linkErrorFromAuth = (location.state as { authLinkError?: string } | null)?.authLinkError;
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [accountExists, setAccountExists] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (linkErrorFromAuth) {
      setError(linkErrorFromAuth);
    }
  }, [linkErrorFromAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await resetPassword(email);

    setIsLoading(false);
    if (result.error) {
      setError(result.error.message);
    } else {
      setAccountExists(result.exists ?? true);
      setIsSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
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
            Don't worry, it happens to the best of us
          </h1>
          <p className="text-lg text-muted-foreground">
            Enter your email and we'll send you instructions to reset your password.
          </p>
          <div className="p-6 bg-card rounded-xl border">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Security tip:</span> Never share your password with anyone. Our team will never ask for your password.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md border-0 shadow-xl">
          {!isSubmitted ? (
            <>
              <CardHeader className="space-y-1 text-center">
                <div className="flex items-center justify-center gap-2 lg:hidden mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                    <Logo className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <span className="text-xl font-bold">OpenPlan AI</span>
                </div>
                <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
                <CardDescription>
                  Enter your email address and we'll send you a link to reset your password
                </CardDescription>
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
                    <Label htmlFor="email">Work Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      "Sending..."
                    ) : (
                      <>
                        Send reset link
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Link
                    to="/login"
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to login
                  </Link>
                </CardFooter>
              </form>
            </>
          ) : accountExists ? (
            <>
              <CardHeader className="space-y-1 text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
                <CardDescription className="text-base">
                  We've sent a password reset link to
                </CardDescription>
                <p className="font-medium text-foreground">{email}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center">
                  Didn't receive the email? Check your spam folder or{" "}
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="text-primary underline font-medium"
                  >
                    Try again
                  </button>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Link to="/login" className="w-full">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to login
                  </Button>
                </Link>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-amber-600" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">No account found</CardTitle>
                <CardDescription className="text-base">
                  There's no account registered with
                </CardDescription>
                <p className="font-medium text-foreground">{email}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center">
                  Double-check the email address, or{" "}
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="text-primary underline font-medium"
                  >
                    try again
                  </button>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Link to="/signup" className="w-full">
                  <Button className="w-full">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create an account
                  </Button>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to login
                </Link>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
