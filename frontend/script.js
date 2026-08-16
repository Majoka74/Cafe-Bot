const chatArea = document.getElementById("chatArea");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

const mockReplies = [
  "Got it! Anything else I can add to your order?",
  "Sounds good! Let me know if you'd like to see the full menu.",
  "Thanks! We'll have that ready for you shortly.",
  "Sure thing! Is that for here or to go?",
];

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

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  addMessage(text, "user");
  chatInput.value = "";

  const reply = mockReplies[Math.floor(Math.random() * mockReplies.length)];
  setTimeout(() => addMessage(reply, "bot"), 500);
});
