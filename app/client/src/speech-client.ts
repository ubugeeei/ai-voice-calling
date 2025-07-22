import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export class SpeechClient {
  private speechConfig?: sdk.SpeechConfig;
  private recognizer?: sdk.SpeechRecognizer;
  private synthesizer?: sdk.SpeechSynthesizer;
  private onTranscript: (text: string) => void;
  private isListening = false;

  constructor(onTranscript: (text: string) => void) {
    this.onTranscript = onTranscript;
  }

  async initialize(speechKey: string, speechRegion: string): Promise<void> {
    try {
      // Configure speech service
      this.speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
      this.speechConfig.speechRecognitionLanguage = 'en-US';
      this.speechConfig.speechSynthesisLanguage = 'en-US';
      this.speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';

      // Create recognizer
      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      this.recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

      // Create synthesizer
      this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);

      // Setup recognition handlers
      this.recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
          console.log('Recognized:', e.result.text);
          this.onTranscript(e.result.text);
        }
      };

      this.recognizer.recognizing = (s, e) => {
        console.log('Recognizing:', e.result.text);
      };

      this.recognizer.sessionStopped = (s, e) => {
        console.log('Session stopped');
        this.isListening = false;
      };

      console.log('Speech client initialized');
    } catch (error) {
      console.error('Failed to initialize speech client:', error);
      throw error;
    }
  }

  async startListening(): Promise<void> {
    if (!this.recognizer || this.isListening) return;

    return new Promise((resolve, reject) => {
      this.recognizer!.startContinuousRecognitionAsync(
        () => {
          console.log('Started listening');
          this.isListening = true;
          resolve();
        },
        (error) => {
          console.error('Failed to start listening:', error);
          reject(error);
        }
      );
    });
  }

  async stopListening(): Promise<void> {
    if (!this.recognizer || !this.isListening) return;

    return new Promise((resolve, reject) => {
      this.recognizer!.stopContinuousRecognitionAsync(
        () => {
          console.log('Stopped listening');
          this.isListening = false;
          resolve();
        },
        (error) => {
          console.error('Failed to stop listening:', error);
          reject(error);
        }
      );
    });
  }

  async speak(text: string): Promise<void> {
    if (!this.synthesizer) return;

    return new Promise((resolve, reject) => {
      this.synthesizer!.speakTextAsync(
        text,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            console.log('Speech synthesis completed');
            resolve();
          } else {
            console.error('Speech synthesis failed:', result.errorDetails);
            reject(result.errorDetails);
          }
        },
        (error) => {
          console.error('Speech synthesis error:', error);
          reject(error);
        }
      );
    });
  }

  dispose(): void {
    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = undefined;
    }
    if (this.synthesizer) {
      this.synthesizer.close();
      this.synthesizer = undefined;
    }
    this.speechConfig = undefined;
    this.isListening = false;
  }
}