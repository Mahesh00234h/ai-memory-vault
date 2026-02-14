# AI Context Bridge

AI Context Bridge is a powerful tool designed to streamline your workflow with AI chat platforms. It allows you to capture, store, and inject project context across multiple services, ensuring you never have to re-explain your project again. It consists of a Chrome Extension for seamless interaction and a Web Dashboard for managing your captured memories.

## Key Features

### Chrome Extension
- **Context Bridging:** Seamlessly move context between supported AI platforms.
- **Smart Capture:** Save conversations with detailed breakdowns including summaries, key points, decisions, and open questions.
- **Quick Recall (`Ctrl+Shift+R` / `Cmd+Shift+R`):** Instantly inject relevant project context into your current chat session.
- **Quick Capture (`Ctrl+Shift+C` / `Cmd+Shift+C`):** Save the current conversation as a memory.
- **Quick Inject (`Ctrl+Shift+I` / `Cmd+Shift+I`):** Inject active project context directly into your chat.

### Web Dashboard
- **Project Management:** Organize your memories into projects to scope context ingestion and recall.
- **Memory Management:** Browse your captured memories, search by keywords, filter by source, and view detailed insights.
- **Flexible Export:** Copy context packs in JSON or Markdown formats for use in other tools or agents.
- **Legacy Migration:** Easily migrate memories from V1 to the new V2 native format.
- **Detailed Insights:** View summaries, key points, decisions, and open questions extracted from your conversations.

## Supported Platforms

The extension supports bridging context across the following AI platforms:
- **OpenAI:** ChatGPT (`chat.openai.com`, `chatgpt.com`)
- **Anthropic:** Claude (`claude.ai`)
- **Google:** Gemini (`gemini.google.com`)
- **Microsoft:** Copilot (`copilot.microsoft.com`)
- **Quora:** Poe (`poe.com`)
- **Perplexity:** Perplexity AI (`perplexity.ai`)

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
    This will start the web dashboard locally.

4.  **Load Chrome Extension:**
    1.  Open Chrome and navigate to `chrome://extensions/`.
    2.  Enable "Developer mode" in the top right corner.
    3.  Click "Load unpacked".
    4.  Select the `chrome-extension` directory from the project folder.

## Usage

### Using the Chrome Extension
Once installed, the extension icon will appear in your browser toolbar. Pin it for easy access.
- Navigate to any supported AI chat platform.
- Use the keyboard shortcuts or click the extension icon to access Quick Recall, Capture, and Inject features.

### Using the Web Dashboard
- Access the dashboard (typically `http://localhost:8080` during development or the deployed URL).
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

- **Extension:**
    - Chrome Extension Manifest V3

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request
