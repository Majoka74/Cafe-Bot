# CafeBot

CafeBot is a simple chatbot project for a cafe (e.g. answering menu questions, taking orders, etc.). This repo currently contains only the **project structure** — no application code yet.

## Folder structure

```
Cafe-Bot/
├── prompts/    # System prompts / instructions for the bot
├── data/       # Menu items, FAQs, or other reference data the bot uses
├── frontend/   # User-facing chat interface (to be built)
├── backend/    # Server/API logic that talks to the AI model (to be built)
├── .env.example  # Template for environment variables (API keys, config)
└── .gitignore
```

## Getting started (once code is added)

1. Copy `.env.example` to `.env` and fill in your own values.
2. Never commit your real `.env` file — it's already ignored by `.gitignore`.

## Goals

- Keep things **minimal and low-cost** — no unnecessary services or infrastructure.
- Beginner-friendly: clear folders, small pieces, easy to follow.

## Status

📁 Project structure only. Application code has not been built yet.
