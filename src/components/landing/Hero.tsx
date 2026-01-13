import { LayersIcon } from "@/components/icons/LayersIcon";
import { Button } from "@/components/ui/button";
import { ArrowDown, Download, Sparkles } from "lucide-react";

export function Hero() {
  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToInstall = () => {
    document.getElementById("install")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-50" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] opacity-30 animate-float" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 container px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/50 backdrop-blur-sm mb-8 animate-fade-in">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Chrome Extension for AI Power Users
          </span>
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full" />
            <div className="relative p-5 rounded-2xl bg-gradient-to-br from-primary to-primary/70 glow-effect">
              <LayersIcon className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <span className="gradient-text">AI Context Bridge</span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in" style={{ animationDelay: "300ms" }}>
          Your portable memory layer across AI platforms.
          <br />
          <span className="text-foreground font-medium">
            Never re-explain your project context again.
          </span>
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <Button
            size="lg"
            onClick={scrollToInstall}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-lg px-8 py-6 glow-effect"
          >
            <Download className="w-5 h-5" />
            Get the Extension
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={scrollToFeatures}
            className="border-border hover:bg-secondary gap-2 text-lg px-8 py-6"
          >
            Learn More
            <ArrowDown className="w-5 h-5" />
          </Button>
        </div>

        {/* Supported platforms */}
        <div className="animate-fade-in" style={{ animationDelay: "500ms" }}>
          <p className="text-sm text-muted-foreground mb-4">Works seamlessly with</p>
          <div className="flex flex-wrap justify-center gap-6 items-center opacity-60">
            {["ChatGPT", "Claude", "Gemini", "Copilot", "Perplexity", "Poe"].map((platform) => (
              <span key={platform} className="text-sm font-medium text-foreground/70 px-3 py-1 rounded-full bg-secondary/50">
                {platform}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ArrowDown className="w-6 h-6 text-muted-foreground" />
      </div>
    </section>
  );
}
