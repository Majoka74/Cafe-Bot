import "dotenv/config";
import express from "express";
import cors from "cors";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

const systemPrompt = await readFile(
  path.join(rootDir, "prompts", "system-prompt.md"),
  "utf-8"
);
const menu = await readFile(path.join(rootDir, "data", "menu.json"), "utf-8");

const app = express();
app.use(cors());
app.use(express.json());

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_LENGTH = 20;

function isValidHistory(history) {
  if (!Array.isArray(history)) return false;
  if (history.length > MAX_HISTORY_LENGTH) return false;
  return history.every(
    (entry) =>
      entry &&
      (entry.role === "user" || entry.role === "assistant") &&
      typeof entry.content === "string" &&
      entry.content.length <= MAX_MESSAGE_LENGTH
  );
}

app.post("/api/chat", async (req, res) => {
  const { message, history = [] } = req.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: "message is too long" });
  }
  if (!isValidHistory(history)) {
    return res.status(400).json({ error: "invalid history" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `${systemPrompt}\n\n## Menu data\n${menu}` },
          ...history,
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "";

    res.json({ reply });
  } catch (err) {
    console.error("Chat request failed:", err.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`CafeBot backend listening on port ${port}`);
});
