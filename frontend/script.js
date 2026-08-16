const API_URL = "http://localhost:3000/api/chat";

const chatArea = document.getElementById("chatArea");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

let history = [];
let order = [];
let pickup = {};
let delivery = {};
let awaitingConfirmation = false;

function addMessage(text, sender) {
  const message = document.createElement("div");
  message.className = `message ${sender}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  message.appendChild(bubble);
  chatArea.appendChild(message);
  chatArea.scrollTop = chatArea.scrollHeight;
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  addMessage(text, "user");
  chatInput.value = "";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history,
        order,
        pickup,
        delivery,
        awaitingConfirmation,
      }),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: data.reply });
    order = data.order ?? order;
    pickup = data.pickup ?? pickup;
    delivery = data.delivery ?? delivery;
    awaitingConfirmation = data.awaitingConfirmation ?? awaitingConfirmation;

    addMessage(data.reply, "bot");
  } catch (err) {
    console.error("Chat request failed:", err.message);
    addMessage("Sorry, something went wrong. Please try again.", "bot");
  }
});
