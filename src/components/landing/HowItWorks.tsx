import { ArrowRight } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Create a Project",
    description: "Open the extension and create a project. Add your goal, current progress, tech stack, and any constraints.",
  },
  {
    step: "02",
    title: "Work with Any AI",
    description: "Use ChatGPT, Claude, Gemini, or any supported AI. Capture useful context from conversations as you go.",
  },
  {
    step: "03",
    title: "Switch Platforms",
    description: "When you switch to a different AI, click 'Inject Context' to instantly bring your project context into the new conversation.",
  },
  {
    step: "04",
    title: "Continue Seamlessly",
    description: "The AI immediately understands your project and continues from where you left off. No re-explaining required.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-3/4 bg-gradient-to-b from-transparent via-primary/20 to-transparent hidden lg:block" />
      
      <div className="container px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How It Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Four simple steps to never lose your AI context again
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.step}
              className="relative flex gap-6 md:gap-10 mb-12 last:mb-0 animate-slide-in-right"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {/* Step number */}
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-xl font-bold text-white glow-effect">
                  {step.step}
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:flex flex-col items-center mt-4">
                    <div className="w-px h-8 bg-border" />
                    <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
                    <div className="w-px h-8 bg-border" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="pt-2">
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
