import { 
  Download, 
  Upload, 
  FolderOpen, 
  Zap, 
  Shield, 
  RefreshCw 
} from "lucide-react";

const features = [
  {
    icon: Download,
    title: "Capture Context",
    description: "Grab selected text, full conversations, or write manual context. Edit before saving.",
  },
  {
    icon: FolderOpen,
    title: "Project Management",
    description: "Organize context by project with goals, progress, constraints, tech stack, and notes.",
  },
  {
    icon: Upload,
    title: "One-Click Inject",
    description: "Instantly inject your project context into any AI's input field with a single click.",
  },
  {
    icon: Zap,
    title: "Zero Onboarding",
    description: "The injected prompt tells the AI to skip questions and continue from your context.",
  },
  {
    icon: Shield,
    title: "100% Private",
    description: "All data stays on your device. No servers, no accounts, no tracking whatsoever.",
  },
  {
    icon: RefreshCw,
    title: "Seamless Switching",
    description: "Move between ChatGPT, Claude, Gemini, and more without losing your train of thought.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="container px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need to
            <span className="gradient-text"> Bridge AI Context</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A simple, powerful extension that gives you complete control over your AI conversations across platforms.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl border border-border bg-card/50 hover:bg-card hover:border-primary/50 transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
