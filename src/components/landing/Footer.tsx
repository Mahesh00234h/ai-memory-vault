import { LayersIcon } from "@/components/icons/LayersIcon";
import { Github, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-12 border-t border-border">
      <div className="container px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <LayersIcon className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold">AI Context Bridge</span>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AI Context Bridge. Open source & privacy-first.
          </p>

          {/* Social links */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Twitter className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
