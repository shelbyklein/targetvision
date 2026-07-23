import { Link } from "wouter";
import { Image, Star, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useGetRegistrationSettings } from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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
            <Button data-testid="sign-in-btn" className="bg-[#1a2f53] hover:bg-[#152541] text-white border-[#1a2f53] hover:border-[#152541] focus-visible:ring-[#1a2f53]">Sign In</Button>
          </Link>
          {registrationEnabled && (
            <Link href="/sign-up">
              <Button data-testid="sign-up-btn" className="bg-[#aa1f2e] hover:bg-[#8e1a26] text-white border-[#aa1f2e] hover:border-[#8e1a26] focus-visible:ring-[#aa1f2e]">Sign Up</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-20 text-center">

        <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6 leading-tight">
          Pick the right photos<br />for marketing, together.
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Vispix is USA Archery's internal workspace for staff to collaborate on choosing
          photos for marketing. Browse event albums, rate candidates, and shortlist the shots
          that belong on the next campaign — together, in one place.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link href="/sign-in">
            <Button size="lg" data-testid="home-sign-in-btn" className="px-8 bg-[#1a2f53] hover:bg-[#152541] text-white border-[#1a2f53] hover:border-[#152541] focus-visible:ring-[#1a2f53]">
              Sign In
            </Button>
          </Link>
          {registrationEnabled ? (
            <Link href="/sign-up">
              <Button size="lg" data-testid="home-sign-up-btn" className="px-8 bg-[#aa1f2e] hover:bg-[#8e1a26] text-white border-[#aa1f2e] hover:border-[#8e1a26] focus-visible:ring-[#aa1f2e]">
                Sign Up
              </Button>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="registration-disabled-msg">
              Registration is by invitation only. Contact your administrator to get access.
            </p>
          )}
        </div>

        <div className="mt-24 grid grid-cols-3 gap-8 text-left">
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Image className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Albums by Event</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pull together every shot from a shoot or event so the team can review the full
              set in one place before picking favorites.
            </p>
          </div>
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Collaborative Ratings</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Rate candidates as a team so the strongest marketing photos rise to the top
              and decisions are easy to defend.
            </p>
          </div>
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Tags & Collections</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tag by athlete, event, or campaign and group shortlisted shots into collections
              ready to hand off to designers.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-8 text-sm text-muted-foreground">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
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
