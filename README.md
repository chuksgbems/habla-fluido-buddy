# Language Buddy

Master Spanish and English with AI-powered lessons, chat tutoring, and real-time pronunciation feedback.

## Features

- **Learning Path** — Structured units and lessons with interactive exercises
- **AI Chat Tutor** — Practice conversation with Buddy, your AI language partner
- **Pronunciation Lab** — Record your voice and get similarity feedback
- **Vocabulary Practice** — Flashcards and spaced repetition
- **Progress Tracking** — XP, streaks, and lesson completion stats

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (auth, database, edge functions)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher) and npm — install via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Git

### Clone and Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/chuksgbems/habla-fluido-buddy.git

# 2. Navigate into the project directory
cd habla-fluido-buddy

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

The project uses Supabase for backend services. A `.env` file is required at the project root with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
```

### Build for Production

```bash
npm run build
npm run preview
```
