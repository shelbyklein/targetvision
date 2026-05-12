import React, { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/target-vision.svg`,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "hsl(216, 54%, 24%)",
    colorForeground: "hsl(216, 14%, 15%)",
    colorMutedForeground: "hsl(216, 10%, 45%)",
    colorDanger: "hsl(354, 69%, 39%)",
    colorBackground: "hsl(216, 20%, 97%)",
    colorInput: "hsl(216, 12%, 88%)",
    colorInputForeground: "hsl(216, 14%, 15%)",
    colorNeutral: "hsl(216, 12%, 88%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card rounded-2xl w-[440px] max-w-full overflow-hidden shadow-md border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-semibold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground text-sm font-medium",
    footerActionLink: "text-primary hover:text-primary/80 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-600",
    alertText: "text-foreground",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border border-border bg-background hover:bg-accent transition-colors",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 font-medium",
    formFieldInput: "border border-input bg-background text-foreground focus:ring-ring",
    footerAction: "bg-accent/30",
    dividerLine: "bg-border",
    alert: "border border-border bg-accent/20 rounded-md",
    otpCodeFieldInput: "border border-input bg-background text-foreground text-center",
    formFieldRow: "gap-2",
    main: "gap-4",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function PoweredByUSAA() {
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

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      <PoweredByUSAA />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      <PoweredByUSAA />
    </div>
  );
}

function LazyPage({ load }: { load: () => Promise<{ default: React.ComponentType }> }) {
  const [Component, setComponent] = React.useState<React.ComponentType | null>(null);
  useEffect(() => {
    load().then((m) => setComponent(() => m.default));
  }, [load]);
  if (!Component) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  return <Component />;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to Target Vision",
            subtitle: "Sign in to access your team photos",
          },
        },
        signUp: {
          start: {
            title: "Join Target Vision",
            subtitle: "Create an account to get started",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/">
            {() => (
              <>
                <Show when="signed-in">
                  <Redirect to="/dashboard" />
                </Show>
                <Show when="signed-out">
                  <LazyPage load={() => import("@/pages/home")} />
                </Show>
              </>
            )}
          </Route>
          <Route path="/dashboard">
            {() => (
              <>
                <Show when="signed-in">
                  <LazyPage load={() => import("@/pages/dashboard")} />
                </Show>
                <Show when="signed-out">
                  <Redirect to="/sign-in" />
                </Show>
              </>
            )}
          </Route>
          <Route path="/albums">
            {() => (
              <>
                <Show when="signed-in">
                  <LazyPage load={() => import("@/pages/albums")} />
                </Show>
                <Show when="signed-out">
                  <Redirect to="/sign-in" />
                </Show>
              </>
            )}
          </Route>
          <Route path="/albums/:id">
            {() => (
              <>
                <Show when="signed-in">
                  <LazyPage load={() => import("@/pages/album-detail")} />
                </Show>
                <Show when="signed-out">
                  <Redirect to="/sign-in" />
                </Show>
              </>
            )}
          </Route>
          <Route path="/photos/:id">
            {() => (
              <>
                <Show when="signed-in">
                  <LazyPage load={() => import("@/pages/photo-detail")} />
                </Show>
                <Show when="signed-out">
                  <Redirect to="/sign-in" />
                </Show>
              </>
            )}
          </Route>
          <Route path="/photos">
            {() => (
              <>
                <Show when="signed-in">
                  <LazyPage load={() => import("@/pages/photos")} />
                </Show>
                <Show when="signed-out">
                  <Redirect to="/sign-in" />
                </Show>
              </>
            )}
          </Route>
          <Route path="/tags">
            {() => (
              <>
                <Show when="signed-in">
                  <LazyPage load={() => import("@/pages/tags")} />
                </Show>
                <Show when="signed-out">
                  <Redirect to="/sign-in" />
                </Show>
              </>
            )}
          </Route>
          <Route path="/admin">
            {() => (
              <>
                <Show when="signed-in">
                  <LazyPage load={() => import("@/pages/admin")} />
                </Show>
                <Show when="signed-out">
                  <Redirect to="/sign-in" />
                </Show>
              </>
            )}
          </Route>
          <Route path="/search">
            {() => (
              <>
                <Show when="signed-in">
                  <LazyPage load={() => import("@/pages/search")} />
                </Show>
                <Show when="signed-out">
                  <Redirect to="/sign-in" />
                </Show>
              </>
            )}
          </Route>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route>
            <LazyPage load={() => import("@/pages/not-found")} />
          </Route>
        </Switch>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
