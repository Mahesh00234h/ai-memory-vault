# AI Memory Vault 🧠

> **Your portable memory layer for AI conversations** — Never lose context when switching between AI platforms.

AI Memory Vault is a comprehensive solution that bridges the memory gap across AI chat platforms. It consists of a **Chrome Extension** for seamless context capture and injection, paired with a **Web Dashboard** for advanced memory management, project organization, and intelligent context analysis.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](chrome-extension/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

---

## 🎯 The Problem

AI tools don't share memory. Every time you:
- Switch from ChatGPT to Claude
- Start a new conversation in the same AI
- Work across multiple AI platforms on the same project

You lose all your project context and have to re-explain everything from scratch. **AI Memory Vault solves this.**

---

## ✨ Key Features

### 🔌 Chrome Extension

#### Context Capture
- **🎯 Smart Capture**: Automatically analyzes and structures conversations into:
  - Summaries
  - Key points
  - Decisions made
  - Open questions
  - Action items
- **✍️ Manual Input**: Write context directly in the extension
- **🖱️ Selection Capture**: Grab highlighted text from any AI conversation with right-click
- **💬 Conversation Capture**: Extract full visible chat from supported platforms

#### Quick Actions (Keyboard Shortcuts)
- **Quick Recall** (`Ctrl+Shift+R` / `Cmd+Shift+R`): Instantly inject relevant project context into your current chat
- **Quick Capture** (`Ctrl+Shift+C` / `Cmd+Shift+C`): Save the current conversation as a memory
- **Quick Inject** (`Ctrl+Shift+I` / `Cmd+Shift+I`): Inject active project context directly into chat input

#### Context Injection
- One-click inject context into any AI chat
- Automatic clipboard fallback if direct injection fails
- Formatted prompts optimized for AI understanding
- Smart platform detection and DOM manipulation

#### Team Collaboration (V2 Features)
- **Team Projects**: Share context across team members
- **Real-time Sync**: Live updates using Supabase Realtime
- **Session Sharing**: Auto-detect web app authentication
- **Invite Codes**: Easy team member onboarding
- **Team Summaries**: Collaborative context documentation

#### Offline-First Architecture
- **Sync Queue**: Automatically queue changes when offline
- **Background Sync**: Process queue when connection is restored
- **Local Storage**: All data persists locally first
- **Conflict Resolution**: Smart merging of offline changes

---

### 🖥️ Web Dashboard

#### Project Management
- **📂 Organize Memories**: Group memories into projects for better organization
- **🏷️ Project Metadata**: Track project goals, tech stack, constraints, and progress
- **🔄 Project Switching**: Easily switch between different project contexts
- **🗂️ Scoped Context**: Filter memories and insights by project

#### Memory Management
- **📊 Browse Memories**: View all captured conversations and contexts
- **🔍 Advanced Search**: Find memories by keywords, source platform, or date
- **📝 Detailed Insights**: View AI-generated summaries, key points, decisions, and open questions
- **🏷️ Source Tracking**: Know which AI platform each memory came from
- **📅 Timeline View**: See your memory capture history over time

#### Context Export & Portability
- **📋 Copy Context**: One-click copy to clipboard
- **📄 JSON Export**: Export context packs for API integrations
- **📝 Markdown Export**: Export formatted context for documentation
- **🔄 Legacy Migration**: Migrate V1 extension memories to V2 native format

#### Authentication & Security
- **🔐 Supabase Auth**: Secure email/password authentication
- **👤 User Profiles**: Display name and preferences
- **🛡️ Protected Routes**: Automatic redirect to login when unauthenticated
- **🔑 Session Management**: Persistent sessions with auto-refresh

#### Intelligent Memory Ingestion
- **🤖 AI Analysis**: Automatic conversation analysis using Gemini API
- **📊 Structured Extraction**: Extract summaries, decisions, questions, and action items
- **🎯 Context Scoring**: Relevance scoring for better recall
- **🔗 Relationship Mapping**: Link related memories and projects

---

## 🌐 Supported AI Platforms

The extension seamlessly works with:

| Platform | URLs Supported |
|----------|----------------|
| **OpenAI ChatGPT** | `chat.openai.com`, `chatgpt.com` |
| **Anthropic Claude** | `claude.ai` |
| **Google Gemini** | `gemini.google.com` |
| **Microsoft Copilot** | `copilot.microsoft.com` |
| **Quora Poe** | `poe.com` |
| **Perplexity AI** | `perplexity.ai` |

Each platform has custom selectors and injection logic for maximum compatibility.

---

## 🚀 Installation

### Prerequisites
- **Node.js** (v18+) and **npm** installed (use [nvm](https://github.com/nvm-sh/nvm) for version management)
- **Chrome Browser** (or Chromium-based browser)
- **Supabase Account** (for backend features)

### Web Dashboard Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Mahesh00234h/ai-memory-vault.git
   cd ai-memory-vault
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Configure Environment Variables**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   # or
   bun run dev
   ```
   
   The web dashboard will be available at `http://localhost:8080`

5. **Build for Production**
   ```bash
   npm run build
   ```

### Chrome Extension Setup

1. **Navigate to Extension Directory**
   ```bash
   cd chrome-extension
   ```

2. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top-right corner)
   - Click **"Load unpacked"**
   - Select the `chrome-extension` folder from the project
   - The extension icon will appear in your browser toolbar

3. **Pin Extension** (Optional but recommended)
   - Click the puzzle icon in Chrome toolbar
   - Find "AI Context Bridge"
   - Click the pin icon to keep it visible

---

## 📖 Usage Guide

### Using the Chrome Extension

#### First-Time Setup
1. Click the extension icon
2. Enter your name for onboarding
3. (Optional) Log in to enable V2 cloud sync features

#### Capturing Context from AI Chats

**Method 1: Quick Capture (Keyboard Shortcut)**
- While on any supported AI platform, press `Ctrl+Shift+C` (or `Cmd+Shift+C` on Mac)
- The extension automatically captures the visible conversation
- AI analysis runs in the background to structure the content

**Method 2: Manual Capture**
1. Click the extension icon
2. Navigate to the "Captured" tab
3. Click the **"Capture"** button
4. Choose:
   - **Capture Selection**: Grab highlighted text
   - **Capture Conversation**: Extract full chat
   - **Manual Input**: Type context directly

**Method 3: Context Menu (Right-Click)**
- Select text on any AI chat page
- Right-click and choose "Capture Selection"

#### Injecting Context into AI Chats

**Method 1: Quick Inject (Keyboard Shortcut)**
- Press `Ctrl+Shift+I` (or `Cmd+Shift+I` on Mac)
- Active project context is instantly injected

**Method 2: Manual Injection**
1. Open any supported AI chat platform
2. Click the extension icon
3. Ensure your project is active (purple dot indicator)
4. Click **"Inject Context"**
5. Context appears in the chat input field

**Method 3: Quick Recall**
- Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- Most relevant context for current project is injected

#### Managing Projects

**Create a Project**
1. Click extension icon
2. Go to "Projects" tab
3. Click the **"+"** button
4. Fill in:
   - Project name
   - Goal/description
   - Tech stack
   - Constraints
5. Click **"Save Project"**

**Switch Active Project**
- Click on any project to make it active
- Active project is indicated by a purple dot
- All captures are scoped to the active project

#### Team Features (V2)

**Create a Team**
1. Go to the "Team" tab
2. Click **"Create Team"**
3. Enter team name
4. Share the generated invite code

**Join a Team**
1. Get invite code from team admin
2. Go to "Team" tab
3. Click **"Join Team"**
4. Enter invite code

**Team Context Sync**
- Captured contexts automatically sync to team members
- Real-time updates via Supabase Realtime
- Create team summaries for collaborative documentation

---

### Using the Web Dashboard

#### Authentication
1. Navigate to the deployed URL (or `localhost:8080` in development)
2. Click **"Sign Up"** to create an account
3. Enter display name, email, and password
4. Or click **"Sign In"** if you already have an account

#### Project Management
1. Navigate to **"Projects"** in the sidebar
2. Click **"New Project"** to create a project
3. Fill in project details
4. View all project memories from the project detail page

#### Memory Management
1. Navigate to **"Memories"** in the sidebar
2. Browse all captured memories across projects
3. Use the search bar to find specific topics
4. Filter by:
   - Source platform (ChatGPT, Claude, etc.)
   - Date captured
   - Project
5. Click any memory to view detailed analysis:
   - Full conversation text
   - AI-generated summary
   - Key points extracted
   - Decisions made
   - Open questions
   - Action items

#### Context Export
1. Select a memory
2. Click **"Copy"** for clipboard
3. Or choose:
   - **"Export as JSON"**: For API integrations
   - **"Export as Markdown"**: For documentation

#### Legacy Migration
1. Navigate to **"Settings"** or **"Migration"**
2. Click **"Migrate V1 Memories"**
3. System automatically migrates old extension memories to new format

---

## 🏗️ Project Structure

```
ai-memory-vault/
├── chrome-extension/           # Chrome Extension (Manifest V3)
│   ├── manifest.json          # Extension configuration
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # Popup styles
│   ├── popup.js               # Popup logic & state management
│   ├── content.js             # DOM interaction on AI platforms
│   ├── background.js          # Service worker & sync logic
│   ├── api.js                 # Supabase API client
│   ├── icons/                 # Extension icons (16, 32, 48, 128px)
│   └── README.md              # Extension-specific docs
│
├── src/                       # React Web Dashboard
│   ├── App.tsx                # Root component & routing
│   ├── main.tsx               # React entry point
│   ├── index.css              # Global styles & design system
│   │
│   ├── pages/                 # Page components
│   │   ├── Index.tsx          # Landing page
│   │   ├── Login.tsx          # Login page
│   │   ├── Signup.tsx         # Signup page
│   │   ├── NotFound.tsx       # 404 page
│   │   └── app/               # Authenticated app pages
│   │       ├── AppLayout.tsx  # Main app layout
│   │       ├── ProjectsPage.tsx
│   │       └── MemoriesPage.tsx
│   │
│   ├── components/            # Reusable components
│   │   ├── landing/           # Landing page sections
│   │   ├── ui/                # shadcn-ui components
│   │   └── ...
│   │
│   ├── auth/                  # Authentication
│   │   └── ProtectedRoute.tsx
│   │
│   ├── lib/                   # Utilities
│   │   └── utils.ts           # Helper functions
│   │
│   └── integrations/          # External integrations
│       └── supabase/
│           └── client.ts      # Supabase client
│
├── supabase/                  # Supabase backend
│   ├── config.toml            # Supabase configuration
│   ├── functions/             # Edge Functions
│   │   ├── analyze-context/
│   │   ├── ingest-memory/
│   │   ├── recall-memory/
│   │   ├── migrate-v1-memories/
│   │   ├── migrate-user-data/
│   │   ├── merge-team-context/
│   │   └── recall-team-memory/
│   └── migrations/            # Database migrations
│
├── public/                    # Static assets
│   └── dl/                    # Downloadable extension builds
│
├── docs/                      # Documentation
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite build configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── components.json            # shadcn-ui configuration
└── README.md                  # This file
```

---

## 🛠️ Technology Stack

### Frontend (Web Dashboard)
- **[Vite](https://vitejs.dev/)** - Next-generation frontend build tool
- **[React 18.3](https://react.dev/)** - UI library with hooks and concurrent features
- **[TypeScript 5.0](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[React Router 6.30](https://reactrouter.com/)** - Client-side routing
- **[TanStack Query 5.0](https://tanstack.com/query)** - Async state management & caching
- **[Tailwind CSS 3.4](https://tailwindcss.com/)** - Utility-first CSS framework
- **[shadcn-ui](https://ui.shadcn.com/)** - Beautiful components built with Radix UI
- **[Lucide React](https://lucide.dev/)** - Icon library

### Backend
- **[Supabase](https://supabase.com/)** - Open-source Firebase alternative
  - PostgreSQL database
  - Row Level Security (RLS) policies
  - Real-time subscriptions
  - Authentication (email/password)
  - Edge Functions (Deno runtime)
  - Storage for file uploads

### Chrome Extension
- **Manifest V3** - Latest Chrome extension standard
- **Vanilla JavaScript** - No framework overhead
- **Chrome Storage API** - Local persistence
- **Chrome Runtime API** - Message passing
- **Service Worker** - Background processing

### AI & Analysis
- **[Google Gemini API](https://ai.google.dev/)** - Conversation analysis & summarization
- Custom prompt engineering for context extraction

### Development Tools
- **[ESLint](https://eslint.org/)** - Code linting
- **[PostCSS](https://postcss.org/)** - CSS processing
- **[Bun](https://bun.sh/)** - Fast JavaScript runtime (optional)

---

## 🗄️ Database Schema

### Core Tables

#### `projects`
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key → auth.users)
- `name` (text)
- `description` (text)
- `tech_stack` (text)
- `constraints` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `memories` (V2 Native Format)
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key → auth.users)
- `project_id` (UUID, foreign key → projects)
- `source` (text) - AI platform name
- `raw_content` (text) - Original conversation
- `summary` (text) - AI-generated summary
- `key_points` (jsonb) - Extracted key points
- `decisions` (jsonb) - Decisions made
- `open_questions` (jsonb) - Open questions
- `action_items` (jsonb) - Action items
- `metadata` (jsonb) - Additional structured data
- `captured_at` (timestamp)
- `created_at` (timestamp)

#### `raw_captures` (Raw Storage)
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key → auth.users)
- `source_url` (text)
- `source_platform` (text)
- `raw_text` (text)
- `captured_at` (timestamp)

#### `teams`
- `id` (UUID, primary key)
- `name` (text)
- `invite_code` (text, unique)
- `created_by` (UUID, foreign key → auth.users)
- `created_at` (timestamp)

#### `team_members`
- `id` (UUID, primary key)
- `team_id` (UUID, foreign key → teams)
- `user_id` (UUID, foreign key → auth.users)
- `role` (text) - 'admin' | 'member'
- `joined_at` (timestamp)

#### `team_contexts` (Shared Team Memories)
- `id` (UUID, primary key)
- `team_id` (UUID, foreign key → teams)
- `project_name` (text)
- `raw_content` (text)
- `summary` (text)
- `uploaded_by` (UUID, foreign key → auth.users)
- `created_at` (timestamp)

#### `team_summaries` (Collaborative Documentation)
- `id` (UUID, primary key)
- `team_id` (UUID, foreign key → teams)
- `title` (text)
- `content` (text)
- `created_by` (UUID, foreign key → auth.users)
- `created_at` (timestamp)

---

## 🔧 Configuration

### Environment Variables

#### Web Dashboard (`.env`)
```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Gemini API (for AI analysis)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# App URL (for redirects)
VITE_APP_URL=http://localhost:8080
```

#### Chrome Extension (`chrome-extension/background.js` & `api.js`)
- Update `SUPABASE_URL` constant
- Update `SUPABASE_ANON_KEY` constant
- Update `WEB_APP_ORIGINS` array with deployed web app URL

### Supabase Configuration

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com/)
   - Create a new project
   - Copy project URL and anon key

2. **Run Migrations**
   ```bash
   supabase migration up
   ```

3. **Configure Edge Functions**
   - Deploy edge functions from `supabase/functions/`
   - Set environment variables for each function

4. **Enable Realtime**
   - Enable Realtime for `team_contexts` and `team_summaries` tables

5. **Configure Auth**
   - Enable email/password authentication
   - Set up email templates
   - Configure redirect URLs

---

## 🚢 Deployment

### Web Dashboard

#### Deploy to Vercel
```bash
npm run build
vercel --prod
```

#### Deploy to Netlify
```bash
npm run build
netlify deploy --prod
```

#### Deploy to Supabase Hosting
```bash
npm run build
supabase functions deploy
```

### Chrome Extension

#### Package for Chrome Web Store
1. Update `manifest.json` version
2. Create a ZIP file of the `chrome-extension` folder
3. Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Fill in store listing details
5. Submit for review

#### Distribute as Unpacked Extension
1. Zip the `chrome-extension` folder
2. Host on your website or GitHub releases
3. Users can download and load unpacked

---

## 🔐 Privacy & Security

### Data Storage
- **Local-First**: Extension stores data in Chrome local storage first
- **Optional Cloud Sync**: Users can opt-in to cloud sync via authentication
- **Encrypted Transit**: All API calls use HTTPS
- **Row-Level Security**: Supabase RLS policies ensure users only see their own data

### Permissions
The extension requests minimal permissions:
- `storage`: Store projects and contexts locally
- `activeTab`: Access current tab for context injection
- `tabs`: Detect AI platform URLs
- `clipboardWrite`: Copy context to clipboard
- `contextMenus`: Right-click capture menu
- `cookies`: Share auth session with web app
- `scripting`: Inject context into AI platforms

### Privacy Policy
- No analytics or tracking
- No data sold to third parties
- User data is only used for core functionality
- Users can export and delete all their data

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Reporting Bugs
1. Check existing [GitHub Issues](https://github.com/Mahesh00234h/ai-memory-vault/issues)
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

### Suggesting Features
1. Open a [GitHub Issue](https://github.com/Mahesh00234h/ai-memory-vault/issues/new)
2. Tag it as "enhancement"
3. Describe the feature and use case

### Pull Requests
1. **Fork the Repository**
   ```bash
   gh repo fork Mahesh00234h/ai-memory-vault
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make Your Changes**
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

4. **Test Your Changes**
   ```bash
   npm run lint
   npm run build
   ```

5. **Commit with Conventional Commits**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

6. **Push to Your Fork**
   ```bash
   git push origin feature/amazing-feature
   ```

7. **Open a Pull Request**
   - Provide clear description of changes
   - Reference any related issues
   - Add screenshots for UI changes

### Development Guidelines
- Use TypeScript for type safety
- Follow React best practices (hooks, composition)
- Write self-documenting code
- Keep components small and focused
- Use Tailwind CSS for styling
- Test on multiple AI platforms

---

## 🗺️ Roadmap

### V3 Planned Features
- [ ] **Multi-Modal Context**: Support images, code snippets, and files
- [ ] **Advanced Search**: Vector search for semantic memory retrieval
- [ ] **Browser Sync**: Chrome sync storage for cross-device access
- [ ] **End-to-End Encryption**: Encrypt sensitive project data
- [ ] **API Webhooks**: Integrate with external tools (Slack, Notion, etc.)
- [ ] **Browser Extensions**: Firefox and Edge support
- [ ] **Mobile App**: Capture context on mobile devices
- [ ] **AI Model Selection**: Choose between GPT-4, Claude, Gemini for analysis
- [ ] **Custom Tags**: User-defined tags for memories
- [ ] **Smart Recommendations**: AI suggests relevant context based on current conversation
- [ ] **Context Templates**: Pre-made templates for common project types
- [ ] **Collaboration Features**: Comments, mentions, and shared workspaces
- [ ] **Advanced Analytics**: Memory usage statistics and insights

---

## 📄 License

MIT License

Copyright (c) 2026 Mahesh00234h

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🙏 Acknowledgments

- [shadcn-ui](https://ui.shadcn.com/) for beautiful component primitives
- [Supabase](https://supabase.com/) for the amazing backend platform
- The open-source community for inspiration and tools

---

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/Mahesh00234h/ai-memory-vault/issues)
- **Documentation**: Check the `/docs` folder for detailed guides
- **Extension Docs**: See `chrome-extension/README.md` for extension-specific info

---

## 🌟 Star History

If you find this project useful, please consider giving it a ⭐ on GitHub!

---

**Built with ❤️ by [Mahesh00234h](https://github.com/Mahesh00234h)**
