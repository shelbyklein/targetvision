import { useState } from "react";
import { Link } from "wouter";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function PoweredByUSAA() {
  return (
    <div className="flex items-center justify-center gap-2 mt-5">
      <span className="text-xs text-muted-foreground/70">a</span>
      <a
        href="https://www.usarchery.org"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center"
      >
        <img src={`${basePath}/usaa-horizontal.svg`} alt="USA Archery" className="h-5 w-auto opacity-70" />
      </a>
      <span className="text-xs text-muted-foreground/70">product</span>
    </div>
  );
}

export function AuthCardLogo() {
  return (
    <div className="flex justify-center mb-2">
      <img src={`${basePath}/vispix.png`} alt="Vispix" className="h-10 w-auto rounded-md" />
    </div>
  );
}

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn.email({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? "Sign in failed");
      return;
    }
    // Full-page navigation so the session cookie is picked up fresh —
    // a client-side route change can race the useSession store update.
    window.location.assign(`${basePath}/dashboard`);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
      <Card className="w-[440px] max-w-full rounded-2xl shadow-md">
        <CardHeader className="text-center">
          <AuthCardLogo />
          <CardTitle>Welcome back to Vispix</CardTitle>
          <CardDescription>Sign in to start picking photos for marketing</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/sign-up" className="font-medium text-primary hover:text-primary/80">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      <PoweredByUSAA />
    </div>
  );
}
