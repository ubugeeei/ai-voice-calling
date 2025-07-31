import "./style.css";
import { AIClient } from "./ai-client";

// Get DOM elements
const statusSpan = document.getElementById(
	"status"
) as HTMLSpanElement;
const callBtn = document.getElementById(
	"call-btn"
) as HTMLButtonElement;
const hangupBtn = document.getElementById(
	"hangup-btn"
) as HTMLButtonElement;
const remoteAudio = document.getElementById(
	"remote-audio"
) as HTMLAudioElement;

let aiClient: AIClient | null = null;

// Mode selector
const modeInputs = document.querySelectorAll('input[name="mode"]');
const aiChatDiv = document.getElementById(
	"ai-chat"
) as HTMLDivElement;
const chatMessagesDiv = document.getElementById(
	"chat-messages"
) as HTMLDivElement;
const languageSelectorDiv = document.getElementById(
	"language-selector"
) as HTMLDivElement;

// Language change handler
modeInputs.forEach((input) => {
	input.addEventListener("change", (e) => {
		const target = e.target as HTMLInputElement;
		languageSelectorDiv.style.display =
			target.value === "ai" ? "flex" : "none";
	});
});

// Update status display
function updateStatus(status: string) {
	statusSpan.textContent = status;
	statusSpan.className = status === "Connected" ? "connected" : "";
}

// Get current language
function getCurrentLanguage(): string {
	const checkedLang = document.querySelector(
		'input[name="language"]:checked'
	) as HTMLInputElement;
	return checkedLang?.value || "en-US";
}

// Add message to chat
function addChatMessage(
	type: "user" | "ai" | "system",
	text: string
) {
	const messageDiv = document.createElement("div");
	messageDiv.className = `chat-message ${type}`;
	messageDiv.textContent = text;
	chatMessagesDiv.appendChild(messageDiv);
	chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

// Handle AI messages
function handleAIMessage(type: string, data: any) {
	addChatMessage(type as any, data);
}

// Start call
async function startCall() {
	try {
		// Disable call button, enable hangup button
		callBtn.disabled = true;
		hangupBtn.disabled = false;
		modeInputs.forEach(
			(input) => ((input as HTMLInputElement).disabled = true)
		);

		// Show/hide chat for AI mode

		aiChatDiv.style.display = "block";
		chatMessagesDiv.innerHTML = "";
		addChatMessage("system", "Connecting to AI Assistant...");

		// Create AI client with language setting
		const language = getCurrentLanguage();
		aiClient = new AIClient(
			import.meta.env.VITE_WS_URL,
			updateStatus,
			handleAIMessage,
			language
		);
		// TODO:
		await aiClient.connect("test");

		updateStatus("Connecting...");
	} catch (error) {
		console.error("Failed to start call:", error);
		updateStatus("Failed to start call");
		hangup();
	}
}

// Hang up call
function hangup() {
	if (aiClient) {
		aiClient.hangup();
		aiClient = null;
	}

	// Reset UI
	callBtn.disabled = false;
	hangupBtn.disabled = true;

	modeInputs.forEach(
		(input) => ((input as HTMLInputElement).disabled = false)
	);
	remoteAudio.srcObject = null;
	aiChatDiv.style.display = "none";
	updateStatus("Disconnected");
}

// Event listeners
callBtn.addEventListener("click", startCall);
hangupBtn.addEventListener("click", hangup);
