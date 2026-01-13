export function ExtensionPreview() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Clean, Minimal
            <span className="gradient-text"> Interface</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A popup that stays out of your way until you need it
          </p>
        </div>

        {/* Preview mockup */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-3xl" />
            
            {/* Extension popup mockup */}
            <div className="relative w-[380px] rounded-2xl overflow-hidden border border-border shadow-2xl">
              {/* Header */}
              <div className="bg-[#141416] border-b border-[#27272a] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                      <path d="M2 17L12 22L22 17" />
                      <path d="M2 12L12 17L22 12" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-white">AI Context Bridge</span>
                </div>
                <button className="w-7 h-7 rounded-md border border-[#27272a] flex items-center justify-center text-[#71717a] hover:text-white transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>

              {/* Project list */}
              <div className="bg-[#0d0d0f] p-3 space-y-2">
                {/* Active project */}
                <div className="flex items-start gap-3 p-3 rounded-xl border border-primary/50 bg-primary/5">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">E-commerce Platform</div>
                    <div className="text-xs text-[#71717a]">Updated today</div>
                  </div>
                </div>

                {/* Other project */}
                <div className="flex items-start gap-3 p-3 rounded-xl border border-[#27272a] bg-[#141416] hover:bg-[#1a1a1d] transition-colors">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-[#222225]" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">Mobile App Redesign</div>
                    <div className="text-xs text-[#71717a]">Updated yesterday</div>
                  </div>
                </div>

                {/* Other project */}
                <div className="flex items-start gap-3 p-3 rounded-xl border border-[#27272a] bg-[#141416] hover:bg-[#1a1a1d] transition-colors">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-[#222225]" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">API Integration</div>
                    <div className="text-xs text-[#71717a]">Updated 2 days ago</div>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="bg-[#141416] border-t border-[#27272a] p-3 flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary text-white text-xs font-medium">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                  Inject Context
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-[#27272a] bg-[#1a1a1d] text-[#a1a1aa] text-xs font-medium">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-[#27272a] bg-[#1a1a1d] text-[#a1a1aa] text-xs font-medium">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Capture
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
