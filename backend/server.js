import "dotenv/config";
import express from "express";
import cors from "cors";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addItemToOrder, updateOrderItem } from "./order.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

const systemPrompt = await readFile(
  path.join(rootDir, "prompts", "system-prompt.md"),
  "utf-8"
);
const menuData = JSON.parse(
  await readFile(path.join(rootDir, "data", "menu.json"), "utf-8")
);
const menuPrompt = `## Menu data
Only mention items, prices, and details listed below. Never invent items,
prices, or details that aren't in this data.

${JSON.stringify(menuData)}`;

const app = express();
app.use(cors());
app.use(express.json());

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_LENGTH = 20;
const MAX_ORDER_LENGTH = 50;

const orderTools = [
  {
    type: "function",
    function: {
      name: "add_item_to_order",
      description:
        "Add one valid menu item to the customer's current order. Only call this once you know the item, its size (if it has sizes), and the quantity.",
      parameters: {
        type: "object",
        properties: {
          item_name: { type: "string", description: "The menu item's name" },
          size: {
            type: "string",
            description: "The chosen size, only if the item offers sizes",
          },
          quantity: {
            type: "integer",
            minimum: 1,
            description: "How many of this item to add",
          },
        },
        required: ["item_name", "quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_order_item",
      description:
        "Change the size, quantity, and/or customizations of an item already in the customer's order. Only include the fields that are changing.",
      parameters: {
        type: "object",
        properties: {
          item_name: { type: "string", description: "The menu item's name" },
          current_size: {
            type: "string",
            description:
              "The item's current size in the order, needed only if it appears with more than one size",
          },
          size: { type: "string", description: "The new size, if changing size" },
          quantity: {
            type: "integer",
            minimum: 1,
            description: "The new quantity, if changing quantity",
          },
          customizations: {
            type: "object",
            description:
              "New customization selections as option name/value pairs (e.g. { \"milk\": \"oat\" }). Only include options the item supports.",
            additionalProperties: { type: "string" },
          },
        },
        required: ["item_name"],
      },
    },
  },
];

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

function isValidOrder(order) {
  if (!Array.isArray(order)) return false;
  if (order.length > MAX_ORDER_LENGTH) return false;
  return order.every(
    (line) =>
      line &&
      typeof line.itemId === "string" &&
      typeof line.name === "string" &&
      (line.size === null || typeof line.size === "string") &&
      Number.isInteger(line.quantity) &&
      line.quantity > 0 &&
      typeof line.unitPrice === "number" &&
      typeof line.lineTotal === "number" &&
      (line.customizations === undefined ||
        line.customizations === null ||
        isValidCustomizations(line.customizations))
  );
}

function isValidCustomizations(customizations) {
  if (typeof customizations !== "object" || Array.isArray(customizations)) return false;
  return Object.entries(customizations).every(
    ([key, value]) => typeof key === "string" && typeof value === "string"
  );
}

async function callOpenAI(messages) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      tools: orderTools,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  return response.json();
}

app.post("/api/chat", async (req, res) => {
  const { message, history = [], order = [] } = req.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: "message is too long" });
  }
  if (!isValidHistory(history)) {
    return res.status(400).json({ error: "invalid history" });
  }
  if (!isValidOrder(order)) {
    return res.status(400).json({ error: "invalid order" });
  }

  try {
    let currentOrder = order;
    const messages = [
      { role: "system", content: `${systemPrompt}\n\n${menuPrompt}` },
      ...history,
      { role: "user", content: message },
    ];

    let data = await callOpenAI(messages);
    let replyMessage = data.choices?.[0]?.message;

    if (replyMessage?.tool_calls?.length) {
      messages.push(replyMessage);

      for (const toolCall of replyMessage.tool_calls) {
        let toolResult = { error: "Unknown tool." };

        if (toolCall.function.name === "add_item_to_order") {
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            args = {};
          }

          const result = addItemToOrder(currentOrder, menuData, args);
          if (result.ok) {
            currentOrder = result.order;
            toolResult = { added: result.added };
          } else {
            toolResult = { error: result.error };
          }
        } else if (toolCall.function.name === "update_order_item") {
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            args = {};
          }

          const result = updateOrderItem(currentOrder, menuData, args);
          if (result.ok) {
            currentOrder = result.order;
            toolResult = { updated: result.updated };
          } else {
            toolResult = { error: result.error };
          }
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      data = await callOpenAI(messages);
      replyMessage = data.choices?.[0]?.message;
    }

    res.json({ reply: replyMessage?.content ?? "", order: currentOrder });
  } catch (err) {
    console.error("Chat request failed:", err.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`CafeBot backend listening on port ${port}`);
});
