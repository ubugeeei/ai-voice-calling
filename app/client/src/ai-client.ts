import { SpeechClient } from "./speech-client";

export class AIClient {
	private ws: WebSocket | null = null;
	private roomId: string | null = null;
	private speechClient: SpeechClient;
	private language: string;
	private speechKey?: string;
	private speechRegion?: string;

	constructor(
		private signalingServerUrl: string,
		private onStatusChange: (status: string) => void,
		private onMessage: (type: string, data: any) => void,
		language: string = "en-US"
	) {
		this.language = language;
		// Initialize speech client with transcript handler
		this.speechClient = new SpeechClient((text) => {
			this.handleTranscript(text);
		});
	}

	async connect(roomId: string): Promise<void> {
		this.roomId = roomId;

		// Connect to signaling server
		this.ws = new WebSocket(this.signalingServerUrl);

		this.ws.onopen = () => {
			console.log("Connected to signaling server");
			this.onStatusChange("Connected to server");

			// Join room and enable AI mode with language
			this.sendSignal({ type: "join", roomId });
			this.sendSignal({
				type: "ai-mode",
				roomId,
				aiMode: true,
				language: this.language,
			});
		};

		this.ws.onmessage = async (event) => {
			const message = JSON.parse(event.data);
			await this.handleMessage(message);
		};

		this.ws.onerror = (error) => {
			console.error("WebSocket error:", error);
			this.onStatusChange("Connection error");
		};

		this.ws.onclose = () => {
			console.log("Disconnected from signaling server");
			this.onStatusChange("Disconnected");
		};
	}

	private async handleMessage(message: any): Promise<void> {
		switch (message.type) {
			case "ai-mode-active":
				// Initialize speech client with credentials
				this.speechKey = message.speechKey;
				this.speechRegion = message.speechRegion;
				await this.speechClient.initialize(
					this.speechKey!,
					this.speechRegion!
				);
				this.onStatusChange("AI Assistant Ready");
				await this.speechClient.startListening();
				break;

			case "user-speech":
				this.onMessage("user", message.text);
				break;

			case "ai-response":
				console.log("AI Response:", message.text);
				this.speechClient.dispose();
				console.log("disposed speech client");
				await this.speechClient.initialize(
					this.speechKey!,
					this.speechRegion!
				);
				console.log("re-initialized speech client");
				await this.speechClient.startListening();
				console.log("started listening");
				this.onMessage("ai", message.text);
				console.log("added ai message");
				// Speak the AI response
				await this.speechClient.speak(message.text);
				console.log("spoke ai message");
				break;

			case "status":
				this.onMessage("system", `Status: ${message.status}`);
				break;

			case "error":
				this.onMessage("system", `Error: ${message.message}`);
				this.onStatusChange("Error");
				break;
		}
	}

	private handleTranscript(text: string): void {
		console.log("handleTranscript:", text);
		// Display user speech
		this.onMessage("user", text);

		// Send text to server for AI processing
		this.sendSignal({
			type: "ai-text",
			text: text,
		});
	}

	private sendSignal(message: any): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(
				JSON.stringify({ ...message, roomId: this.roomId })
			);
		}
	}

	hangup(): void {
		// Stop speech client
		this.speechClient.stopListening();
		this.speechClient.dispose();

		// Close WebSocket
		if (this.ws) {
			this.sendSignal({ type: "leave" });
			this.ws.close();
			this.ws = null;
		}

		this.onStatusChange("Disconnected");
	}
}
