# AI Context Bridge

AI Context Bridge is a comprehensive tool designed to streamline your workflow across AI chat platforms. It acts as a **portable memory layer**, allowing you to capture, store, and inject project context seamlessly between services like ChatGPT, Claude, Gemini, and more. Stop repeating yourself—bring your context with you.

This project consists of two main components:
1.  **Chrome Extension:** For seamless interaction, capture, and injection directly within AI interfaces.
2.  **Web Dashboard:** For managing your knowledge base, organizing projects, and collaborating with your team.

---

## 🚀 Key Features

### 🧩 Chrome Extension
The extension is your bridge between AI platforms. It runs quietly in the background and offers powerful tools when you need them.

*   **Context Bridging:** Effortlessly move context from one AI to another. Start a conversation in ChatGPT and continue it in Claude without losing details.
*   **Smart Capture:** Automatically saves conversations with detailed breakdowns:
    *   **Summary:** A concise overview of the chat.
    *   **Key Points:** Important takeaways.
    *   **Decisions:** Choices made during the conversation.
    *   **Open Questions:** Unresolved items to revisit.
*   **V2 Memory System:** Utilizes Supabase for persistent, cloud-based storage, ensuring your memories are available across devices.
*   **Quick Actions (Keyboard Shortcuts):**
    *   **Quick Recall (`Ctrl+Shift+R` / `Cmd+Shift+R`):** Instantly search and inject relevant project context into your current chat.
    *   **Quick Capture (`Ctrl+Shift+C` / `Cmd+Shift+C`):** Save the current conversation as a structured memory.
    *   **Quick Inject (`Ctrl+Shift+I` / `Cmd+Shift+I`):** Inject active project context directly into the chat input.
*   **Offline Mode:** Queues synchronization tasks when connectivity is lost, syncing automatically when you're back online.

### 👥 Team Collaboration & Sharing
Unlock the power of shared knowledge with built-in team features.

*   **Create & Join Teams:** Easily create a team workspace or join an existing one using an invite code.
*   **Share Contexts:** Push valuable conversation contexts to your team's shared library.
*   **Team Summaries:** View high-level summaries of team activities and merged knowledge.
*   **Real-Time Updates:**
    *   **Live Sync:** Team contexts update in real-time across all members.
    *   **Notifications:** Get alerted instantly when new knowledge is shared or merged.

### 📊 Web Dashboard
A centralized hub to manage your personal and team knowledge.

*   **Project Management:** Organize memories into specific projects with defined Goals, Progress, Constraints, and Tech Stacks.
*   **Memory Management:** Browse your entire history of captured conversations.
    *   **Search & Filter:** Find memories by keywords, source platform, or date.
    *   **Detailed Insights:** View the full breakdown of every captured chat.
*   **Flexible Export:** Copy context packs in **JSON** or **Markdown** formats for use in other tools, agents, or documentation.
*   **Legacy Migration:** Seamlessly migrate memories from the V1 local storage format to the new V2 cloud-native system.

---

## 🔌 Supported Platforms

The extension is optimized to work with the following major AI platforms:

*   **OpenAI:** ChatGPT (`chat.openai.com`, `chatgpt.com`)
*   **Anthropic:** Claude (`claude.ai`)
*   **Google:** Gemini (`gemini.google.com`)
*   **Microsoft:** Copilot (`copilot.microsoft.com`)
*   **Quora:** Poe (`poe.com`)
*   **Perplexity:** Perplexity AI (`perplexity.ai`)

---

## 🛠️ Installation

### Prerequisites
*   **Node.js** & **npm** installed (we recommend using `nvm` for version management).
*   A **Google Chrome** (or Chromium-based) browser.

### Steps

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd <project-directory>
    ```

2.  **Install Dependencies:**
    Navigate to the project root and install the necessary packages.
    ```bash
    npm install
    ```

3.  **Run Development Server:**
    Start the web dashboard locally.
    ```bash
    npm run dev
    ```
    This will typically start the dashboard at `http://localhost:8080`.

4.  **Load Chrome Extension:**
    1.  Open Chrome and navigate to `chrome://extensions/`.
    2.  Enable **"Developer mode"** in the top right corner.
    3.  Click **"Load unpacked"**.
    4.  Select the `chrome-extension` directory from the project folder.

---

## 📖 Usage Guide

### Using the Chrome Extension
Once installed, pin the extension icon to your browser toolbar for easy access.

1.  **Onboarding:** Click the extension icon and enter your name to get started.
2.  **Capture:** Navigate to any supported AI chat. The extension can **Auto-capture** conversations, or you can manually trigger it via the popup or `Ctrl+Shift+C`.
3.  **Recall & Inject:** When starting a new chat, use `Ctrl+Shift+R` to find relevant past context and inject it.
4.  **Team Sharing:** In the extension popup, switch to the "Team" tab to view shared contexts or share your current capture with your team.

### Using the Web Dashboard
Access the dashboard (usually `http://localhost:8080` in dev) to manage your data.

1.  **Projects:** Create a new project to group related memories. Define the project's **Goal** and **Tech Stack** to help the AI understand your context better.
2.  **Memories:** Review your captured chats. You can edit the summaries or delete irrelevant ones.
3.  **Team Notifications:** Click the Bell icon to see recent updates from your team.

---

## 🏗️ Technology Stack

This project is built with a modern, robust tech stack:

*   **Frontend:**
    *   [Vite](https://vitejs.dev/) - Next Generation Frontend Tooling
    *   [React](https://react.dev/) - The library for web and native user interfaces
    *   [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript at Any Scale
    *   [Tailwind CSS](https://tailwindcss.com/) - Rapidly build modern websites
    *   [shadcn-ui](https://ui.shadcn.com/) - Beautifully designed components
    *   [Tanstack Query](https://tanstack.com/query/latest) - Powerful asynchronous state management

*   **Backend & Services:**
    *   [Supabase](https://supabase.com/) - Open Source Firebase Alternative (Database, Auth, Edge Functions, Realtime)

*   **Browser Extension:**
    *   **Manifest V3** - The latest iteration of the WebExtensions API for Chrome.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.
