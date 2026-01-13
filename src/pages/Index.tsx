import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { ExtensionPreview } from "@/components/landing/ExtensionPreview";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Installation } from "@/components/landing/Installation";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Hero />
      <Features />
      <ExtensionPreview />
      <HowItWorks />
      <Installation />
      <Footer />
    </div>
  );
};

export default Index;
