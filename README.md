# DevMate AI

<div align="center">

### Your AI-powered developer assistant for debugging, optimization, and security.

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Firestore](https://img.shields.io/badge/Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

</div>

---

## About

DevMate AI is an AI-powered developer assistant that helps developers debug code, optimize performance, and identify security vulnerabilities using Google Gemini.

It provides three specialized modes:

- Debug — identify errors, root causes, and fixes
- Optimize — analyze complexity and improve performance
- Secure — detect vulnerabilities and recommend mitigations

---

## Features

- AI-powered code analysis with Google Gemini
- Debug, Optimize, and Secure modes
- Multi-turn conversations with context
- Firebase Authentication
- User-isolated Firestore conversation history
- Conversation creation, reopening, and deletion
- Responsive developer-focused interface
- Secure backend architecture for API communication

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 19, Vite |
| UI | Material UI |
| Backend | Node.js, Express.js |
| AI | Google Gemini |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Security | Firestore Security Rules |
| Cloud | Google Cloud |
| Version Control | Git, GitHub |

---

## Architecture

<div align="center">

React Frontend  
↓  
Node.js + Express Backend  
↓  
Google Gemini  
↓  
AI Developer Analysis  
↓  
Firestore Conversation History

</div>

---

## Project Structure

    devmate-ai/
    ├── frontend/
    │   ├── src/
    │   └── package.json
    ├── backend/
    │   ├── src/
    │   └── package.json
    ├── firestore.rules
    ├── firebase.json
    ├── .firebaserc
    ├── .gitignore
    └── README.md

---

## Getting Started

### 1. Clone the repository

    git clone https://github.com/vadshan30/DevMate-AI.git
    cd DevMate-AI

### 2. Install frontend dependencies

    cd frontend
    npm install

### 3. Start frontend

    npm run dev

### 4. Install backend dependencies

    cd ../backend
    npm install

### 5. Start backend

    npm run dev

Configure the required Firebase and Gemini environment variables before running the application.

---

## Security

DevMate AI follows a backend-based architecture to keep Gemini credentials away from the frontend.

Security features include:

- Firebase Authentication
- Protected backend API requests
- Firestore Security Rules
- User-specific conversation storage
- Environment-based configuration
- Backend validation for AI modes

---

## Screenshots

### Dashboard

![DevMate AI Dashboard](screenshots/dashboard.png)

### Debug Mode

![Debug Mode](screenshots/debug-mode.png)

### Optimize Mode

![Optimize Mode](screenshots/optimize-mode.png)

### Secure Mode

![Secure Mode](screenshots/secure-mode.png)

---

## Future Improvements

- GitHub repository integration
- Advanced code review
- Automated test generation
- Larger codebase analysis
- Additional programming language support
- Advanced security analysis

---

## Project Status

**MVP Completed**

DevMate AI currently includes authentication, Gemini-powered developer assistance, Debug/Optimize/Secure modes, multi-turn conversations, and Firestore conversation history.

---

## Repository

GitHub: https://github.com/vadshan30/DevMate-AI

---

<div align="center">

### DevMate AI

**Debug. Optimize. Secure.**

Built with React, Node.js, Gemini, Firebase, Firestore, and Google Cloud.

</div>
