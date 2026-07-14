import { useState, useRef, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useSession, signOut } from "@/lib/auth-client";
import { useGetMe } from "@workspace/api-client-react";
import { LayoutDashboard, Images, Shield, LogOut, ChevronsUpDown, Search, Grid2x2, FolderOpen, FolderKanban, Settings, Upload, Pause, Play, CheckCircle2, X, Sparkles, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useBulkUploadOptional } from "@/contexts/BulkUploadContext";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const SIDEBAR_COOKIE_NAME = "sidebar_state";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/albums", label: "Albums", icon: Images },
  { href: "/photos", label: "Photos", icon: Grid2x2 },
  { href: "/collections", label: "Collections", icon: FolderOpen },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/smart-collections", label: "Smart", icon: Sparkles },
];

// Reads the persisted sidebar open/collapsed state (written as a cookie by
// SidebarProvider) so the choice survives reloads without a flash of the
// wrong state on first paint.
function getInitialSidebarOpen(): boolean {
  if (typeof document === "undefined") return true;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${SIDEBAR_COOKIE_NAME}=(true|false)`)
  );
  return match ? match[1] === "true" : true;
}

function humanSpeed(bps: number): string {
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function useBannerVisible() {
  const [location] = useLocation();
  const ctx = useBulkUploadOptional();
  return !!(ctx && (ctx.phase === "uploading" || ctx.phase === "complete") && location !== "/bulk-upload");
}

function BulkUploadBanner() {
  const [location] = useLocation();
  const ctx = useBulkUploadOptional();

  if (!ctx || location === "/bulk-upload") return null;
  if (ctx.phase !== "uploading" && ctx.phase !== "complete") return null;

  const { totalFiles, completedFiles, overallProgress, isPaused, speedBps, togglePause, phase, queueFiles, resetQueue } = ctx;

  if (phase === "complete") {
    const totalDone = queueFiles.filter((f) => f.status === "done").length;
    const totalFailed = queueFiles.filter((f) => f.status === "error").length;
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground">Upload complete — </span>
            <span className="text-sm text-muted-foreground">
              {totalDone} photo{totalDone !== 1 ? "s" : ""} uploaded
              {totalFailed > 0 && `, ${totalFailed} failed`}
            </span>
          </div>
          <Link
            href="/bulk-upload"
            className="text-xs text-primary font-medium whitespace-nowrap shrink-0 hover:text-primary/80"
          >
            View results →
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={resetQueue}
            title="Dismiss"
            data-testid="dismiss-upload-banner"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
        <Upload className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Uploading photos…</span>
            <span>
              {completedFiles} / {totalFiles}
              {speedBps > 0 && <span className="ml-2">{humanSpeed(speedBps)}</span>}
            </span>
          </div>
          <Progress value={overallProgress} className="h-1.5" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => { e.stopPropagation(); togglePause(); }}
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Button>
          <Link
            href="/bulk-upload"
            className="text-xs text-primary hover:text-primary/80 font-medium whitespace-nowrap"
          >
            View progress
          </Link>
        </div>
      </div>
    </div>
  );
}

function GlobalSearchBar() {
  const [, setLocation] = useLocation();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    setLocation(`/search?q=${encodeURIComponent(q)}`);
    setValue("");
    inputRef.current?.blur();
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex-1 max-w-md" data-testid="global-search-form">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search photos..."
        className="h-8 pl-8 pr-3 text-sm w-full bg-muted/50 border-transparent focus:bg-background focus:border-input"
        data-testid="global-search-input"
      />
    </form>
  );
}

function ThemeMenuButton() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <SidebarMenuButton
      onClick={toggleTheme}
      tooltip={isDark ? "Switch to light mode" : "Switch to dark mode"}
      data-testid="theme-toggle"
    >
      {isDark ? <Sun /> : <Moon />}
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
    </SidebarMenuButton>
  );
}

function AppSidebar({ location, isAdmin }: { location: string; isAdmin: boolean }) {
  const { data: session } = useSession();
  const user = session?.user;
  const firstName = user?.name?.split(" ")[0];
  const { data: me } = useGetMe();

  const items = [
    ...navItems,
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <Sidebar collapsible="icon" data-testid="app-sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Target Vision">
              <Link href="/dashboard" data-testid="sidebar-brand">
                <img src="/target-vision.svg" alt="Target Vision" className="size-6 shrink-0" />
                <span className="font-semibold tracking-tight">Target Vision</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu data-testid="main-nav">
            {items.map((item) => {
              const Icon = item.icon;
              const active = location === item.href || location.startsWith(item.href + "/");
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                    <Link href={item.href} data-testid={`nav-${item.label.toLowerCase()}`}>
                      <Icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeMenuButton />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={firstName ?? user?.email ?? "Account"}
                  data-testid="user-menu-trigger"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                    {firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                    <span className="truncate font-medium text-foreground">{firstName ?? user?.email ?? "Me"}</span>
                    {user?.email && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-foreground truncate">{user?.name ?? "Team Member"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  {me?.role && (
                    <span className={cn(
                      "mt-1 inline-block text-xs px-1.5 py-0.5 rounded font-medium",
                      me.role === "admin" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
                    )}>
                      {me.role}
                    </span>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2 cursor-pointer" data-testid="settings-link">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                  onSelect={async () => {
                    await signOut();
                    // Full-page navigation so all client auth/query state resets.
                    window.location.assign("/");
                  }}
                  data-testid="sign-out-btn"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: me } = useGetMe();
  const bannerVisible = useBannerVisible();
  const isAdmin = me?.role === "admin";

  return (
    <SidebarProvider defaultOpen={getInitialSidebarOpen()} data-testid="app-layout">
      <AppSidebar location={location} isAdmin={isAdmin} />

      <SidebarInset className="min-h-svh">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1" data-testid="sidebar-toggle" />
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 md:hidden" aria-label="Target Vision">
            <img src="/target-vision.svg" alt="Target Vision" className="h-7 w-7" />
          </Link>
          <GlobalSearchBar />
        </header>

        <main className={cn(
          "flex-1 w-full mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8",
          bannerVisible && "pb-20"
        )}>
          {children}
        </main>

        {!bannerVisible && (
          <footer className="hidden sm:block border-t border-border py-6 text-sm text-muted-foreground">
            <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Copyright</span>
                <img src={`${basePath}/usaa-horizontal.svg`} alt="USA Archery" className="h-5 w-auto opacity-70" />
                <span>{new Date().getFullYear()}</span>
              </div>
              <img src={`${basePath}/usaa-horizontal.svg`} alt="USA Archery" className="h-5 w-auto opacity-70" />
            </div>
          </footer>
        )}
      </SidebarInset>

      <BulkUploadBanner />
    </SidebarProvider>
  );
}
