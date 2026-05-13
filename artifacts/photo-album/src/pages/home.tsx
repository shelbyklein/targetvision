import { Link } from "wouter";
import { Camera, Image, Star, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Home() {
  return (
    <div className="min-h-screen bg-background" data-testid="home-page">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/target-vision.svg" alt="Target Vision" className="h-8 w-8" />
          <span className="text-xl font-semibold tracking-tight text-foreground">Target Vision</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" data-testid="sign-in-btn">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button data-testid="sign-up-btn">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary font-medium mb-8">
          <Camera className="h-4 w-4" />
          Internal Marketing Tool
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6 leading-tight">
          Pick the right photos<br />for marketing, together.
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Target Vision is USA Archery's internal workspace for staff to collaborate on choosing
          photos for marketing. Browse event albums, rate candidates, and shortlist the shots
          that belong on the next campaign — together, in one place.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link href="/sign-up">
            <Button size="lg" data-testid="get-started-btn" className="px-8">
              Get Started
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" data-testid="home-sign-in-btn">
              Sign In
            </Button>
          </Link>
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
            <span>2026</span>
          </div>
          <img src={`${basePath}/usaa-horizontal.svg`} alt="USA Archery" className="h-5 w-auto opacity-70" />
        </div>
      </footer>
    </div>
  );
}
