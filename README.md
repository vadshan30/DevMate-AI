# DevMate AI

> Your AI-powered developer assistant for debugging, optimization, and security.

DevMate AI is an AI-powered developer assistant designed to help developers solve common software development problems using specialized AI workflows.

Instead of functioning as a general-purpose chatbot, DevMate AI focuses on three core developer tasks: debugging code, optimizing performance, and identifying security vulnerabilities.

The application combines **React, Node.js, Express, Google Gemini, Firebase Authentication, and Cloud Firestore** to provide an interactive developer-focused AI experience with persistent, user-isolated conversation history.

---

## Overview

Developers frequently spend time debugging errors, improving inefficient code, and identifying security issues.

DevMate AI brings these workflows into a single interface where developers can select a specific mode and receive structured AI-assisted analysis.

### Core Capabilities

| Mode | Purpose |
|------|---------|
| Debug | Identify errors, explain root causes, provide fixes, and suggest prevention |
| Optimize | Analyze complexity, identify bottlenecks, and improve inefficient code |
| Secure | Identify security vulnerabilities, assess severity, and suggest mitigations |

The application also supports:

- Firebase Authentication
- Google Sign-In
- Multi-turn AI conversations
- Persistent conversation history
- User-isolated Firestore storage
- Conversation management
- Code formatting and copy functionality
- Responsive user interface
- Backend API authentication
- Structured Gemini responses
- Defensive security analysis

---

## Application Preview

### Dashboard

> Add your main application screenshot here.

![DevMate AI Dashboard](screenshots/dashboard.png)

The dashboard provides access to the three primary modes and allows developers to start a new AI-assisted development session.

---

### Debug Mode

> Add a screenshot showing Debug mode with an error analysis here.

![DevMate AI Debug Mode](screenshots/debug-mode.png)

Debug mode helps developers understand programming errors by providing:

- Identified issue
- Root cause
- Recommended fix
- Corrected code
- Edge cases
- Prevention suggestions

The goal is to explain the problem rather than simply provide a replacement solution.

---

### Optimize Mode

> Add a screenshot showing Optimize mode here.

![DevMate AI Optimize Mode](screenshots/optimize-mode.png)

Optimize mode analyzes the efficiency of a solution and focuses on:

- Current time complexity
- Current space complexity
- Performance bottlenecks
- Algorithm improvements
- Improved implementation
- New complexity
- Trade-offs

This helps developers understand both the original and improved approaches.

---

### Secure Mode

> Add a screenshot showing Secure mode here.

![DevMate AI Secure Mode](screenshots/secure-mode.png)

Secure mode analyzes code for common security weaknesses, including:

- SQL Injection
- Hardcoded secrets
- Weak authentication
- Missing authorization
- Cross-Site Scripting
- Command Injection
- Path Traversal
- Sensitive Data Exposure
- Unsafe Input Handling
- Insecure Password Handling

Security findings include relevant information such as severity, impact, and recommended mitigation.

---

### Conversation History

> Add a screenshot showing the Recent Chats sidebar here.

![Conversation History](screenshots/conversation-history.png)

DevMate AI stores conversations in Cloud Firestore, allowing users to return to previous development sessions.

Firestore Security Rules are used to isolate user data so that authenticated users can access only their own conversations.

---

## How It Works

The application follows a simple client-server architecture.

```text
                    ┌─────────────────────┐
                    │      Developer      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   React Frontend    │
                    │      + Vite         │
                    └──────────┬──────────┘
                               │
                         Firebase Auth
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Node.js + Express │
                    │       Backend       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Google Gemini    │
                    │      AI Model       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Structured AI     │
                    │      Response       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   React Chat UI     │
                    └─────────────────────┘


          Firebase Authentication
                    │
                    ▼
              User Identity
                    │
                    ▼
              Cloud Firestore
                    │
                    ▼
          User-Isolated Conversations
