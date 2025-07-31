import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { OpenAI } from "openai";
import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

interface AIBotConfig {
	speechKey: string;
	speechRegion: string;
	openaiKey: string;
	openaiEndpoint?: string;
	deploymentName?: string;
}

export class AIBot {
	private speechConfig: sdk.SpeechConfig;
	private openai: OpenAI;
	private conversationHistory: Array<{
		role: string;
		content: string;
	}> = [];
	private synthesizer?: sdk.SpeechSynthesizer;
	private ws: WebSocket | null = null;

	constructor(config: AIBotConfig) {
		// Azure Speech Service setup
		this.speechConfig = sdk.SpeechConfig.fromSubscription(
			config.speechKey,
			config.speechRegion
		);
		this.speechConfig.speechRecognitionLanguage = "en-US";
		this.speechConfig.speechSynthesisLanguage = "en-US";
		this.speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";

		// OpenAI setup
		if (config.openaiEndpoint) {
			// Azure OpenAI
			this.openai = new OpenAI({
				apiKey: config.openaiKey,
				baseURL: `${config.openaiEndpoint}/openai/deployments/${config.deploymentName}`,
				defaultQuery: { "api-version": "2024-02-15-preview" },
				defaultHeaders: { "api-key": config.openaiKey },
			});
		} else {
			// Standard OpenAI
			this.openai = new OpenAI({
				apiKey: config.openaiKey,
			});
		}

		// Initial system prompt
		this.conversationHistory.push({
			role: "system",
			// TODO: prompt
			content:
				"You are a helpful and friendly AI assistant. Keep your responses concise and conversational. **Don't use emoji**",
		});
	}

	async start(ws: WebSocket): Promise<void> {
		this.ws = ws;

		// Create speech synthesizer for server-side TTS
		this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);

		// Send ready status
		this.sendToClient({ type: "status", status: "ready" });
		console.log("AI Bot ready for conversation");
	}

	// Process audio data from client
	async processAudioData(audioData: string): Promise<void> {
		try {
			// For now, we'll process text input directly
			// Audio processing would require additional setup
			console.log("Processing audio data...");
			this.sendToClient({ type: "status", status: "processing" });
		} catch (error) {
			console.error("Error processing audio:", error);
			this.sendToClient({
				type: "error",
				message: "Failed to process audio",
			});
		}
	}

	// Process text input directly
	async processTextInput(text: string): Promise<void> {
		await this.processUserInput(text);
	}

	private async processUserInput(text: string): Promise<void> {
		try {
			// Add user message to history
			this.conversationHistory.push({ role: "user", content: text });

			// Get AI response
			const model = process.env.AZURE_OPENAI_ENDPOINT
				? "gpt-4" // Azure OpenAI uses deployment name in URL
				: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4";

			const completion = await this.openai.chat.completions.create({
				model: model,
				messages: this.conversationHistory as any,
				temperature: 0.7,
				max_tokens: 150,
			});

			const aiResponse =
				completion.choices[0]?.message?.content || "";

			if (aiResponse) {
				// Add AI response to history
				this.conversationHistory.push({
					role: "assistant",
					content: aiResponse,
				});

				// Send AI response to client
				this.sendToClient({ type: "ai-response", text: aiResponse });

				// Synthesize speech
				await this.speak(aiResponse);
			}
		} catch (error) {
			console.error("Error processing user input:", error);
			this.sendToClient({
				type: "error",
				message: "Failed to process request",
			});
		}
	}

	private async speak(text: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.synthesizer) {
				reject("Synthesizer not initialized");
				return;
			}

			this.synthesizer.speakTextAsync(
				text,
				(result) => {
					if (
						result.reason ===
						sdk.ResultReason.SynthesizingAudioCompleted
					) {
						console.log("Speech synthesized successfully");
						resolve();
					} else {
						console.error(
							"Speech synthesis failed:",
							result.errorDetails
						);
						reject(result.errorDetails);
					}
				},
				(error) => {
					console.error("Speech synthesis error:", error);
					reject(error);
				}
			);
		});
	}

	private sendToClient(data: any): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data));
		}
	}

	stop(): void {
		if (this.synthesizer) {
			this.synthesizer.close();
		}
		this.ws = null;
	}
}
