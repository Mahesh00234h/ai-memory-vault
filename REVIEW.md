# AI Context Bridge - Detailed Review

## 1. Executive Summary
The **AI Context Bridge** is a Chrome extension designed to "port" context between different AI chat platforms (ChatGPT, Claude, Gemini, etc.). It captures conversation history from one chat and allows injecting it into another, ensuring the new AI understands the project context immediately. It also features team collaboration capabilities to share these contexts.

## 2. Project Structure & Duality
The repository currently contains **two distinct applications**:
1.  **`chrome-extension/` (The Active Extension)**: A fully functional, vanilla JavaScript-based Chrome extension. **This is the code currently running the extension.**
2.  **`src/` (The React App)**: A modern React/Vite application using `shadcn-ui`. This appears to be a separate web dashboard or a future "v2" rewrite of the popup that has not yet been integrated into the extension's build process.

## 3. Extension Architecture (`chrome-extension/`)
The extension follows the **Manifest V3** standard.

### Components
*   **Popup (`popup.html`, `popup.js`, `popup.css`)**:
    *   **Tech**: Vanilla HTML, CSS, and JavaScript.
    *   **Role**: The main UI. It handles 4 main views: Onboarding, Project List, Captured Contexts, and Teams.
    *   **Logic**: Manages complex state (local storage + cloud sync) and DOM manipulation manually. It communicates with the Background script and the Supabase API.
*   **Background Service Worker (`background.js`)**:
    *   **Role**: The central orchestrator. It runs persistently in the background.
    *   **Key Functions**:
        *   **Offline Sync Queue**: Manages a robust offline-first system. If the user is offline, actions are queued and processed later.
        *   **AI Analysis**: When a chat is captured, it sends the text to a Supabase Edge Function (`analyze-context`) to generate summaries, key points, and tech stacks using Gemini. If that fails, it falls back to local regex parsing.
        *   **Storage**: Manages `chrome.storage.local` (keeping the last ~50 items locally).
*   **Content Script (`content.js`)**:
    *   **Role**: The "eyes and hands" on the AI websites.
    *   **Functions**:
        *   **Scraping**: Detects the platform (ChatGPT, Claude, Gemini, etc.) and scrapes the conversation text using specific CSS selectors.
        *   **Injection**: Inserts context prompts directly into the chat input field.
        *   **Observation**: Uses `MutationObserver` to watch for new messages and trigger auto-captures.
*   **API Layer (`api.js`)**:
    *   **Role**: Handles all communication with the Supabase backend.
    *   **Realtime**: Connects via WebSockets to Supabase Realtime to listen for new team contexts instantly.

## 4. Detailed Workflows

### A. Capture Workflow
1.  **Trigger**: User chats on a supported platform. `content.js` detects changes (auto-capture) or user clicks "Capture" (manual).
2.  **Extraction**: `content.js` scrapes the text and sends it to `background.js`.
3.  **Analysis**:
    *   `background.js` checks if the URL was recently captured (cooldown).
    *   It attempts to call the cloud AI function to analyze the text.
    *   It extracts: **Summary, Key Points, Tech Stack, Decisions, Open Questions**.
4.  **Storage**:
    *   **Local**: Structured data is saved to Chrome Local Storage.
    *   **Cloud**: If the user is logged in, data (including raw text) is synced to Supabase.

### B. Injection Workflow
1.  **Selection**: User selects a context or project in the Popup.
2.  **Generation**: The popup generates a structured prompt (e.g., "Continue from this context... Key Points: ... Tech Stack: ...").
3.  **Action**: User clicks "Inject".
4.  **Execution**: `popup.js` sends a message to `content.js`, which pastes the prompt into the active chat box.

### C. Team & Sync Workflow
*   **Authentication**: Users are identified by a generic ID stored in local storage and synced to Supabase `extension_users`.
*   **Teams**: Users can create/join teams using invite codes.
*   **Realtime**: When a team member saves a context, `api.js` receives a WebSocket event, and the popup updates the "Team" tab instantly.

## 5. Backend (Supabase)
*   **Database**: Stores Users, Teams, and Captured Contexts.
*   **Edge Functions**: Used for the AI analysis logic (`analyze-context`).
*   **Security**: Uses standard Row Level Security (RLS) patterns (inferred from `api.js`).

## 6. Key Observations
*   **Complexity in Popup**: `popup.js` is very large (~1000 lines) and mixes UI logic, state management, and business logic. This is likely why the React version in `src/` exists—to refactor this into a more maintainable structure.
*   **Robustness**: The extension handles offline states and API failures gracefully (falling back to local logic).
*   **Platform Support**: Hardcoded support for ChatGPT, Claude, Gemini, Copilot, Poe, and Perplexity.
