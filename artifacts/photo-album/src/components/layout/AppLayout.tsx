import { useState, useRef, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { LayoutDashboard, Images, Shield, LogOut, ChevronDown, Search, Grid2x2, FolderOpen, Settings, Upload, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useBulkUploadOptional } from "@/contexts/BulkUploadContext";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/albums", label: "Albums", icon: Images },
  { href: "/photos", label: "Photos", icon: Grid2x2 },
  { href: "/collections", label: "Collections", icon: FolderOpen },
];

function humanSpeed(bps: number): string {
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function BulkUploadBanner() {
  const [location] = useLocation();
  const ctx = useBulkUploadOptional();

  if (!ctx || ctx.phase !== "uploading" || location === "/bulk-upload") return null;

  const { totalFiles, completedFiles, overallProgress, isPaused, speedBps, togglePause } = ctx;

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
            onClick={togglePause}
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
    <form onSubmit={handleSubmit} className="relative hidden sm:block" data-testid="global-search-form">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search photos..."
        className="h-8 pl-8 pr-3 text-sm w-48 focus:w-64 transition-all duration-200 bg-muted/50 border-transparent focus:bg-background focus:border-input"
        data-testid="global-search-input"
      />
    </form>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: me } = useGetMe();

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="app-layout">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <img src="/target-vision.svg" alt="Target Vision" className="h-7 w-7" />
              <span className="font-semibold text-foreground tracking-tight">Target Vision</span>
            </Link>
            <nav className="flex items-center gap-1" data-testid="main-nav">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location === item.href || location.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
              {me?.role === "admin" && (
                <Link
                  href="/admin"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    location === "/admin"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  data-testid="nav-admin"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <GlobalSearchBar />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2" data-testid="user-menu-trigger">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                    {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span className="text-sm text-foreground max-w-[120px] truncate">
                    {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? "Me"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-foreground truncate">{user?.fullName ?? "Team Member"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.emailAddresses?.[0]?.emailAddress}</p>
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
                  onSelect={() => signOut({ redirectUrl: "/" })}
                  data-testid="sign-out-btn"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {children}
      </main>

      <BulkUploadBanner />

      <footer className="border-t border-border py-6 text-sm text-muted-foreground">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Copyright</span>
            <img src={`${basePath}/usaa-horizontal.svg`} alt="USA Archery" className="h-5 w-auto opacity-70" />
            <span>{new Date().getFullYear()}</span>
          </div>
          <img src={`${basePath}/usaa-horizontal.svg`} alt="USA Archery" className="h-5 w-auto opacity-70" />
        </div>
      </footer>
    </div>
  );
}
