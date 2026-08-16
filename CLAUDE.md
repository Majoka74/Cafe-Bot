# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project purpose

CafeBot is a simple chatbot for a cafe — answering menu questions, taking
orders, and similar tasks. It is a **beginner-friendly, low-cost** project:
prefer small, understandable pieces over clever or heavyweight solutions.

## Architecture

```
Cafe-Bot/
├── prompts/    # System prompts / instructions for the bot
├── data/       # Menu items, FAQs, or other reference data the bot uses
├── frontend/   # User-facing chat interface
├── backend/    # Server/API logic that talks to the AI model
├── .env.example  # Template for environment variables
└── .gitignore
```

- **frontend** talks to **backend** over a simple HTTP API.
- **backend** loads prompts from `prompts/` and reference data from `data/`,
  then calls the AI model API.
- No database, queues, or extra infrastructure unless the task explicitly
  requires it — keep hosting and running costs minimal.

## Coding rules

- Keep code simple and readable over clever; this is a beginner-friendly
  codebase.
- Don't add abstractions, config options, or files "for later" — build only
  what the current task needs.
- Match the style of existing code in the file/folder you're editing.
- Don't add dependencies unless necessary; prefer what's already used in the
  project.
- No comments unless they explain a non-obvious "why."

## Security rules

- Never commit secrets, API keys, or `.env` files — only `.env.example` with
  placeholder values belongs in git.
- Never log or print API keys, tokens, or user secrets.
- Validate and sanitize any user input handled by the backend before using it
  in prompts, file paths, or queries.
- Don't disable TLS/certificate verification or auth checks to make something
  "just work."

## Token-saving rules

- Read only the files relevant to the current task, not the whole repo.
- Keep prompts in `prompts/` short and focused — avoid bloated system
  prompts.
- Avoid unnecessary round-trips to the AI model API; don't call it for work
  that can be done with plain code.
- Prefer targeted edits over rewriting whole files.

## Scope discipline

- Modify only the files needed for the current task. Do not refactor,
  reformat, or "clean up" unrelated files or code.
