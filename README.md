# CafeBot

CafeBot is a simple chatbot for a cafe — it answers menu questions and takes
orders through a chat interface, backed by a small Node/Express API. A staff
dashboard shows placed orders and lets staff update their status.

## Folder structure

```
Cafe-Bot/
├── prompts/    # System prompt for the bot
├── data/       # Menu items, promotions, and placed orders (JSON files)
├── frontend/   # Static chat UI + staff dashboard (plain HTML/CSS/JS)
├── backend/    # Express API that loads prompts/data and calls the AI model
├── .env.example  # Template for environment variables (API keys, config)
└── .gitignore
```

- **frontend** talks to **backend** over a simple HTTP API.
- **backend** loads the system prompt from `prompts/` and menu/promotions
  data from `data/`, then calls the OpenAI API.
- Orders are stored in `data/orders.json`, a plain file — no database.

## Local setup

1. Install backend dependencies:
   ```
   cd backend
   npm install
   ```
2. Copy `.env.example` to `.env` in the project root and fill in your own
   values (at minimum, `OPENAI_API_KEY`). Never commit your real `.env`
   file — it's already ignored by `.gitignore`.
3. Start the backend:
   ```
   npm start
   ```
   It listens on `PORT` from `.env` (default `3000`).
4. Open `frontend/index.html` in a browser for the chat UI, and
   `frontend/dashboard.html` for the staff dashboard. Both are static files
   — you can open them directly or serve them with any static file server.

## Environment variables

See `.env.example` for the full list:

- `OPENAI_API_KEY` — API key for the AI model CafeBot uses. Required.
- `PORT` — port the backend server listens on. Defaults to `3000`.
- `TAX_RATE` — sales tax rate applied to the discounted subtotal, as a
  decimal (e.g. `0.08` = 8%). Defaults to `0`.
- `DELIVERY_FEE` — flat delivery fee applied to delivery orders, in
  dollars. Defaults to `0`.

## Deploying

The backend and frontend can be deployed separately, or together on a
single low-cost host — a small Node hosting service (e.g. Render, Railway,
Fly.io) works well for the backend since it needs to run continuously and
read/write `data/orders.json`.

1. Deploy `backend/` to a Node host and set the environment variables above
   there (never commit a real `.env` file).
2. Deploy `frontend/` as a static site (or serve it from the same host).
3. Update `API_URL` at the top of `frontend/script.js` and
   `frontend/dashboard.js` to point at your deployed backend's URL instead
   of `http://localhost:3000`.

Because orders are stored in `data/orders.json` on disk, pick a host that
gives the backend a persistent filesystem — on hosts with ephemeral/
read-only filesystems, placed orders won't survive a restart or redeploy.

## Goals

- Keep things **minimal and low-cost** — no unnecessary services or
  infrastructure.
- Beginner-friendly: clear folders, small pieces, easy to follow.
