import { AboutSection } from "@/components/about-section";
import { FeatureGrid } from "@/components/feature-grid";
import { Footer } from "@/components/footer";
import { GlitchMarquee } from "@/components/glitch-marquee";
import { HeroSection } from "@/components/hero-section";
import { Navbar } from "@/components/navbar";
import { PricingSection } from "@/components/pricing-section";

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <HeroSection />
      <FeatureGrid />
      <AboutSection />
      <PricingSection />
      <GlitchMarquee />
      <Footer />
    </main>
  );
}
