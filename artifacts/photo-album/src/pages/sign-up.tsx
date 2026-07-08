import { useState } from "react";
import { Link } from "wouter";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PoweredByUSAA, AuthCardLogo } from "@/pages/sign-in";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signUpError } = await signUp.email({ name, email, password });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message ?? "Sign up failed");
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
          <CardTitle>Join Target Vision</CardTitle>
          <CardDescription>Create an account to help choose USA Archery&apos;s marketing photos</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating account…" : "Sign up"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-medium text-primary hover:text-primary/80">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      <PoweredByUSAA />
    </div>
  );
}
