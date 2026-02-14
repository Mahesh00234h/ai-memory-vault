import { Button } from "@/components/ui/button";
import { Check, Copy, Download, ExternalLink, FolderOpen, Loader2, Puzzle, Settings } from "lucide-react";
import { useState } from "react";
import JSZip from "jszip";

const EXTENSION_FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "api.js",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
];

const installSteps = [
  {
    icon: Download,
    title: "Download Extension",
    description: "Click the button below to download the extension as a ZIP file.",
  },
  {
    icon: FolderOpen,
    title: "Unzip the File",
    description: "Extract the downloaded ZIP file to a folder on your computer.",
  },
  {
    icon: Settings,
    title: "Open Chrome Extensions",
    description: "Navigate to chrome://extensions/ in your Chrome browser.",
    code: "chrome://extensions/",
  },
  {
    icon: Puzzle,
    title: "Enable Developer Mode",
    description: "Toggle the 'Developer mode' switch in the top-right corner.",
  },
  {
    icon: Check,
    title: "Load Unpacked",
    description: "Click 'Load unpacked' and select the extracted folder.",
  },
];

export function Installation() {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadExtension = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("ai-context-bridge");

      await Promise.all(
        EXTENSION_FILES.map(async (filePath) => {
          const response = await fetch(`/dl/chrome-extension/${filePath}`);
          if (!response.ok) throw new Error(`Failed to fetch ${filePath}`);
          const blob = await response.blob();
          folder!.file(filePath, blob);
        })
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ai-context-bridge-extension.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section id="install" className="py-24 relative">
      {/* Background glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[100px] opacity-50" />

      <div className="container px-6 relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Get Started in
            <span className="gradient-text"> 2 Minutes</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Simple installation process. No account required.
          </p>
        </div>

        {/* Installation card */}
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8">
            {/* Steps */}
            <div className="space-y-8">
              {installSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex gap-4 animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{step.title}</h3>
                    <p className="text-muted-foreground text-sm mb-2">
                      {step.description}
                    </p>
                    {step.code && (
                      <div className="flex items-center gap-2 mt-2">
                        <code className="px-3 py-1.5 rounded-lg bg-secondary font-mono text-sm">
                          {step.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(step.code!)}
                          className="h-8 px-2"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-success" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-10 pt-8 border-t border-border flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 gap-2 glow-effect"
                onClick={downloadExtension}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                {downloading ? "Preparing Download..." : "Download Extension"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={() => window.open("https://github.com", "_blank")}
              >
                <ExternalLink className="w-5 h-5" />
                View on GitHub
              </Button>
            </div>
          </div>

          {/* Note */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            The extension is completely free, open-source, and respects your privacy.
          </p>
        </div>
      </div>
    </section>
  );
}