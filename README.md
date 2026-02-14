# AI Context Bridge

AI Context Bridge is a powerful productivity tool designed to streamline your workflow with AI chat platforms. It allows you to capture, store, and inject project context across multiple services, ensuring you never have to re-explain your project again. It consists of a **Chrome Extension** for seamless interaction and a **Web Dashboard** for managing your captured memories.

## Key Features

### Chrome Extension Deep Dive

The AI Context Bridge Chrome Extension is more than just a simple bookmarking tool. It actively bridges your project context between different AI platforms (e.g., ChatGPT -> Claude) using intelligent analysis and cloud sync.

#### Core Capabilities
- **Context Bridging:** Seamlessly move context between supported AI platforms. Start a conversation in ChatGPT, capture it, and continue with full context in Claude.
- **Smart Capture & AI Analysis:** The extension captures conversation text and uses **Gemini-powered analysis** (via Supabase Edge Functions) or a robust local fallback to extract:
    - **Topic/Title:** Automatically generated meaningful titles.
    - **Summary:** Concise summaries of the conversation.
    - **Key Points:** Crucial takeaways and action items.
    - **Tech Stack:** Detected technologies (e.g., React, Node.js, Python).
    - **Decisions Made:** Tracks architectural decisions.
    - **Open Questions:** Highlights unresolved queries.
    - **Rich Context:** Extracts "Core Insights", "Strategic Direction", and "What Has Been Built".
- **V2 Memory System (New):**
    - **Ingest:** Directly ingests memories into the V2 system (Supabase backend) for long-term storage and semantic search.
    - **Recall (`recall-memory`):** Uses semantic search to find relevant past conversations based on your current context.
    - **Sync:** Automatically syncs captured contexts to the cloud (Supabase) for cross-device access.
- **Offline Mode:** Works even when you're offline. Captures and updates are queued locally and automatically processed when you reconnect.
- **Team Collaboration:** Share contexts with team members in real-time. View shared summaries and collaborative project updates directly within the extension popup.

#### Popup Dashboard
The extension popup (`popup.html`) serves as your command center:
- **Onboarding:** Set your user name and create or join teams.
- **Captured Tab:** Browse your auto-captured and manually saved contexts. View rich metadata (tech stack, key points) at a glance.
- **Team Tab:** Access shared team contexts and collaborative summaries.
- **Projects Tab:** Manage your active projects. Define goals, progress, constraints, and tech stacks.
- **Quick Actions:** Toggle **Auto-capture** (automatically saves chats on supported platforms) and **V2 Memory** (enables the new ingest/recall system).

#### Keyboard Shortcuts
Boost your productivity with these global shortcuts (configurable in `chrome://extensions/shortcuts`):
- **`Ctrl+Shift+R` (Mac: `Cmd+Shift+R`): Quick Recall** - Instantly injects relevant V2 memories into your current chat session based on semantic search.
- **`Ctrl+Shift+C` (Mac: `Cmd+Shift+C`): Quick Capture** - Forces a capture of the current conversation, saving it as a memory.
- **`Ctrl+Shift+I` (Mac: `Cmd+Shift+I`): Quick Inject** - Injects the context of your currently *active project* directly into the chat input.

#### Background & Architecture
- **Session Monitoring:** The background script (`background.js`) intelligently detects your web app session (via cookies or localStorage) to authenticate API calls securely.
- **Batch Sync:** When you land on a supported AI platform, the extension can trigger a background sync to ensure your latest chats are up-to-date.
- **Platform Support:** Uses specific DOM selectors in `content.js` to accurately extract conversation text from:
    - **OpenAI:** ChatGPT (`chat.openai.com`, `chatgpt.com`)
    - **Anthropic:** Claude (`claude.ai`)
    - **Google:** Gemini (`gemini.google.com`)
    - **Microsoft:** Copilot (`copilot.microsoft.com`)
    - **Quora:** Poe (`poe.com`)
    - **Perplexity:** Perplexity AI (`perplexity.ai`)

### Web Dashboard Features
- **Project Management:** Organize your memories into projects to scope context ingestion and recall.
- **Memory Management:** Browse your captured memories, search by keywords, filter by source, and view detailed insights.
- **Flexible Export:** Copy context packs in JSON or Markdown formats for use in other tools or agents.
- **Legacy Migration:** Easily migrate memories from V1 to the new V2 native format.
- **Detailed Insights:** View summaries, key points, decisions, and open questions extracted from your conversations.

## Installation

### Prerequisites
- Node.js & npm installed (use `nvm` for version management)

### Steps

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd <project-directory>
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    This will start the web dashboard locally (typically `http://localhost:8080`).

4.  **Load Chrome Extension:**
    1.  Open Chrome and navigate to `chrome://extensions/`.
    2.  Enable "Developer mode" in the top right corner.
    3.  Click "Load unpacked".
    4.  Select the `chrome-extension` directory from the project folder.

## Usage

### Using the Chrome Extension
Once installed, the extension icon will appear in your browser toolbar. Pin it for easy access.
- **Navigate** to any supported AI chat platform (e.g., ChatGPT).
- **Auto-Capture:** If enabled, the extension will automatically capture your conversation as you chat.
- **Manual Control:** Click the extension icon to view captured contexts, switch projects, or manage team sharing.
- **Shortcuts:** Use `Ctrl+Shift+R` to recall relevant past context into your current chat.

### Using the Web Dashboard
- Access the dashboard at the local or deployed URL.
- **Create a Project:** Navigate to the Projects page to create a new project. Projects help you organize memories.
- **View Memories:** Go to the Memories page to see all captured contexts. Use the search bar to find specific topics or keywords.
- **Copy Context:** Use the "Copy" buttons to copy memory details or full context packs (JSON/Markdown) to your clipboard.

## Technologies

This project is built with a modern tech stack:

- **Frontend:**
    - [Vite](https://vitejs.dev/) - Next Generation Frontend Tooling
    - [React](https://react.dev/) - The library for web and native user interfaces
    - [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript at Any Scale
    - [Tailwind CSS](https://tailwindcss.com/) - Rapidly build modern websites without ever leaving your HTML
    - [shadcn-ui](https://ui.shadcn.com/) - Beautifully designed components built with Radix UI and Tailwind CSS

- **Backend:**
    - [Supabase](https://supabase.com/) - Open Source Firebase Alternative (Database, Auth, Edge Functions)
    - **Edge Functions:** Used for `analyze-context`, `ingest-memory`, and `recall-memory`.

- **Extension:**
    - Chrome Extension Manifest V3
    - Background Service Worker
    - Content Scripts
    - Popup UI (HTML/CSS/JS)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request
