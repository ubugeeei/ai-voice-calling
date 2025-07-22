import './style.css'
import { WebRTCClient } from './webrtc-client'
import { AIClient } from './ai-client'

// Get DOM elements
const statusSpan = document.getElementById('status') as HTMLSpanElement;
const roomIdInput = document.getElementById('room-id') as HTMLInputElement;
const callBtn = document.getElementById('call-btn') as HTMLButtonElement;
const hangupBtn = document.getElementById('hangup-btn') as HTMLButtonElement;
const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement;

// Client instances
let webrtcClient: WebRTCClient | null = null;
let aiClient: AIClient | null = null;

// Mode selector
const modeInputs = document.querySelectorAll('input[name="mode"]');
const aiChatDiv = document.getElementById('ai-chat') as HTMLDivElement;
const chatMessagesDiv = document.getElementById('chat-messages') as HTMLDivElement;
const languageSelectorDiv = document.getElementById('language-selector') as HTMLDivElement;

// Language change handler
modeInputs.forEach(input => {
  input.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    languageSelectorDiv.style.display = target.value === 'ai' ? 'flex' : 'none';
  });
});

// Update status display
function updateStatus(status: string) {
  statusSpan.textContent = status;
  statusSpan.className = status === 'Connected' ? 'connected' : '';
}

// Handle remote stream
function handleRemoteStream(stream: MediaStream) {
  console.log('Received remote stream');
  remoteAudio.srcObject = stream;
}

// Get current mode
function getCurrentMode(): string {
  const checkedMode = document.querySelector('input[name="mode"]:checked') as HTMLInputElement;
  return checkedMode?.value || 'human';
}

// Get current language
function getCurrentLanguage(): string {
  const checkedLang = document.querySelector('input[name="language"]:checked') as HTMLInputElement;
  return checkedLang?.value || 'en-US';
}

// Add message to chat
function addChatMessage(type: 'user' | 'ai' | 'system', text: string) {
  const messageDiv = document.createElement('div');
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
  const roomId = roomIdInput.value.trim();
  const mode = getCurrentMode();
  
  if (!roomId) {
    alert('Please enter a room ID');
    return;
  }

  try {
    // Disable call button, enable hangup button
    callBtn.disabled = true;
    hangupBtn.disabled = false;
    roomIdInput.disabled = true;
    modeInputs.forEach(input => (input as HTMLInputElement).disabled = true);

    // Show/hide chat for AI mode
    if (mode === 'ai') {
      aiChatDiv.style.display = 'block';
      chatMessagesDiv.innerHTML = '';
      addChatMessage('system', 'Connecting to AI Assistant...');
    } else {
      aiChatDiv.style.display = 'none';
    }

    const signalingServerUrl = `ws://localhost:3001`;

    if (mode === 'ai') {
      // Create AI client with language setting
      const language = getCurrentLanguage();
      aiClient = new AIClient(
        signalingServerUrl,
        updateStatus,
        handleAIMessage,
        language
      );
      await aiClient.connect(roomId);
    } else {
      // Create WebRTC client
      webrtcClient = new WebRTCClient(
        signalingServerUrl,
        updateStatus,
        handleRemoteStream
      );
      await webrtcClient.connect(roomId);
    }
    
    updateStatus('Connecting...');
  } catch (error) {
    console.error('Failed to start call:', error);
    updateStatus('Failed to start call');
    hangup();
  }
}

// Hang up call
function hangup() {
  if (webrtcClient) {
    webrtcClient.hangup();
    webrtcClient = null;
  }
  
  if (aiClient) {
    aiClient.hangup();
    aiClient = null;
  }

  // Reset UI
  callBtn.disabled = false;
  hangupBtn.disabled = true;
  roomIdInput.disabled = false;
  modeInputs.forEach(input => (input as HTMLInputElement).disabled = false);
  remoteAudio.srcObject = null;
  aiChatDiv.style.display = 'none';
  updateStatus('Disconnected');
}

// Event listeners
callBtn.addEventListener('click', startCall);
hangupBtn.addEventListener('click', hangup);
roomIdInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !callBtn.disabled) {
    startCall();
  }
});
