import { AboutSection } from "@/components/about-section";
import { FeatureGrid } from "@/components/feature-grid";
import { Footer } from "@/components/footer";
import { GlitchMarquee } from "@/components/glitch-marquee";
import { HeroSection } from "@/components/hero-section";
import { Navbar } from "@/components/navbar";
import { DotPattern } from "@/components/ui/dot-pattern";


export default function Page() {
  return (
    <main className="relative min-h-screen text-foreground">
      <DotPattern className="fixed inset-0 -z-10 text-zinc-500/50" width={20} height={20} cr={1.2} />
      <Navbar />
      <HeroSection />
      <FeatureGrid />
      <AboutSection />
      <GlitchMarquee />
      <Footer />
    </main>
  );
}
