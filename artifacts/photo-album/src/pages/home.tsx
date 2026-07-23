import { Link } from "wouter";
import { Upload, Sparkles, Star, FolderOpen, Search, CopyCheck, Users, Tag, Bot, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useGetRegistrationSettings } from "@workspace/api-client-react";
import { PLAN_CARDS, PLAN_ORDER, ENTERPRISE_CONTACT } from "@/lib/planDisplay";

// The pitch, in the order a visitor needs it (#136): what it is (hero), how it
// works (4 steps), what makes it different (feature grid), what it costs
// (pricing from the shared plan display, so this page can't drift from
// billing). Copy stays honest to the current feature set.

const STEPS = [
  { icon: Upload, title: "Upload", text: "Drag in photos or whole ZIPs — thousands at a time." },
  { icon: Sparkles, title: "AI does the triage", text: "Every photo gets a description; duplicates and near-duplicates get flagged." },
  { icon: Star, title: "Rate together", text: "Your whole team scores candidates, so the best shots rise." },
  { icon: FolderOpen, title: "Ship collections", text: "Shortlist into collections and hand off to design." },
];

const FEATURES = [
  {
    icon: Search,
    title: "Search photos like you'd describe them",
    text: "AI writes a description for every photo, so \"celebrating in the rain\" finds it — no manual tagging required.",
  },
  {
    icon: CopyCheck,
    title: "Duplicate & near-duplicate cleanup",
    text: "Byte-identical copies and visually-similar shots surfaced automatically, with side-by-side review to clear them fast.",
  },
  {
    icon: Star,
    title: "Collaborative ratings",
    text: "Everyone scores candidates in place — decisions get made once, together, and they're easy to defend.",
  },
  {
    icon: FolderOpen,
    title: "Collections, projects & usage rights",
    text: "Group shortlists by campaign, track what each photo is cleared for, and keep hand-offs organized.",
  },
  {
    icon: Users,
    title: "People tagging",
    text: "Tag the people in your photos and pull up every shot of an athlete or speaker in one click.",
  },
  {
    icon: Bot,
    title: "Your library, answerable by AI",
    text: "Connect Claude or other AI tools straight to your photo library via MCP — ask for photos in plain language from anywhere.",
  },
];

export default function Home() {
  const { data: regSettings } = useGetRegistrationSettings();
  const registrationEnabled = regSettings?.registrationEnabled ?? true;

  return (
    <div className="min-h-screen bg-background" data-testid="home-page">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/vispix.png" alt="Vispix" className="h-8 w-8 rounded" />
          <span className="text-xl font-semibold tracking-tight text-foreground">Vispix</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/sign-in">
            <Button variant="outline" data-testid="sign-in-btn">Sign In</Button>
          </Link>
          {registrationEnabled && (
            <Link href="/sign-up">
              <Button data-testid="sign-up-btn">Sign Up</Button>
            </Link>
          )}
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6 leading-tight">
            Pick the right photos<br />for marketing, together.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Vispix gives your team one workspace to sort thousands of event photos: AI describes
            and de-duplicates them, natural-language search finds them, and collaborative ratings
            decide what ships.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/sign-in">
              <Button size="lg" variant="outline" data-testid="home-sign-in-btn" className="px-8">
                Sign In
              </Button>
            </Link>
            {registrationEnabled ? (
              <Link href="/sign-up">
                <Button size="lg" data-testid="home-sign-up-btn" className="px-8 gap-1.5">
                  Start free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="registration-disabled-msg">
                Registration is by invitation only. Contact your administrator to get access.
              </p>
            )}
          </div>
          {registrationEnabled && (
            <p className="mt-3 text-xs text-muted-foreground">2 GB free · no card required</p>
          )}
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-card/50">
          <div className="max-w-5xl mx-auto px-6 py-14">
            <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-8">
              How it works
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <div key={step.title} className="text-center space-y-2">
                  <div className="mx-auto h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">
                    <span className="text-primary mr-1.5">{i + 1}.</span>
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 text-left">
            {FEATURES.map((f) => (
              <div key={f.title} className="space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t border-border bg-card/50">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <h2 className="text-center text-2xl font-bold text-foreground mb-2">Simple pricing</h2>
            <p className="text-center text-sm text-muted-foreground mb-10">
              Priced by storage, not seats — invite your whole team on any plan.
            </p>
            <div className="grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto">
              {PLAN_ORDER.map((id) => {
                const plan = PLAN_CARDS[id];
                const highlight = id === "pro";
                return (
                  <div
                    key={id}
                    className={`rounded-xl border p-5 flex flex-col ${highlight ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                    data-testid={`home-plan-${id}`}
                  >
                    <h3 className="font-semibold text-foreground">{plan.label}</h3>
                    <p className="mt-1 text-2xl font-bold text-foreground">{plan.priceDisplay}</p>
                    <p className="mt-2 text-sm text-muted-foreground flex-1">{plan.blurb}</p>
                    <div className="mt-4">
                      {id === "enterprise" ? (
                        <a href={ENTERPRISE_CONTACT}>
                          <Button variant="outline" size="sm" className="w-full">Contact us</Button>
                        </a>
                      ) : registrationEnabled ? (
                        <Link href="/sign-up">
                          <Button size="sm" variant={highlight ? "default" : "outline"} className="w-full">
                            {id === "free" ? "Start free" : "Start with Pro"}
                          </Button>
                        </Link>
                      ) : (
                        <Button size="sm" variant="outline" className="w-full" disabled>
                          By invitation
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-6 inline-flex w-full justify-center items-center gap-1">
              <Tag className="h-3 w-3" /> Every plan includes AI descriptions, search, ratings, and collections.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-sm text-muted-foreground">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Vispix</span>
          <a href={ENTERPRISE_CONTACT} className="hover:text-foreground">hello@vispix.dev</a>
        </div>
      </footer>
    </div>
  );
}
