import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { AIBot } from './ai-bot';

dotenv.config();

interface Room {
  clients: Set<WebSocket>;
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'ai-mode' | 'ai-text';
  roomId?: string;
  offer?: any;
  answer?: any;
  candidate?: any;
  aiMode?: boolean;
  text?: string;
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store rooms and their clients
const rooms = new Map<string, Room>();

// Store client to room mapping
const clientRooms = new Map<WebSocket, string>();

// Store AI bot instances
const aiBots = new Map<string, AIBot>();

wss.on('connection', (ws: WebSocket, request) => {
  console.log('New client connected from:', request.headers.origin);

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message: SignalingMessage = JSON.parse(data.toString());
      handleSignalingMessage(ws, message);
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    handleClientDisconnect(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleSignalingMessage(ws: WebSocket, message: SignalingMessage) {
  const { type, roomId } = message;

  switch (type) {
    case 'join':
      if (roomId) {
        handleJoinRoom(ws, roomId);
      }
      break;

    case 'offer':
    case 'answer':
    case 'ice-candidate':
      // Relay message to other clients in the room
      relayToOthers(ws, message);
      break;

    case 'leave':
      handleClientDisconnect(ws);
      break;

    case 'ai-mode':
      if (roomId && message.aiMode) {
        handleAIMode(ws, roomId);
      }
      break;

    case 'ai-text':
      if (roomId && message.text) {
        handleAIText(ws, roomId, message.text);
      }
      break;
  }
}

function handleJoinRoom(ws: WebSocket, roomId: string) {
  // Remove from previous room if any
  const previousRoom = clientRooms.get(ws);
  if (previousRoom) {
    leaveRoom(ws, previousRoom);
  }

  // Get or create room
  let room = rooms.get(roomId);
  if (!room) {
    room = { clients: new Set() };
    rooms.set(roomId, room);
  }

  // Notify existing clients that someone joined
  room.clients.forEach(client => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'join', roomId }));
    }
  });

  // Add client to room
  room.clients.add(ws);
  clientRooms.set(ws, roomId);

  console.log(`Client joined room ${roomId}. Room size: ${room.clients.size}`);
}

function leaveRoom(ws: WebSocket, roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    room.clients.delete(ws);
    
    // Notify other clients
    room.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'leave', roomId }));
      }
    });

    // Clean up empty room
    if (room.clients.size === 0) {
      rooms.delete(roomId);
    }

    console.log(`Client left room ${roomId}. Room size: ${room.clients.size}`);
  }
  
  clientRooms.delete(ws);
}

function handleClientDisconnect(ws: WebSocket) {
  const roomId = clientRooms.get(ws);
  if (roomId) {
    // Clean up AI bot if exists
    const aiBot = aiBots.get(roomId);
    if (aiBot) {
      aiBot.stop();
      aiBots.delete(roomId);
    }
    
    leaveRoom(ws, roomId);
  }
}

function relayToOthers(sender: WebSocket, message: SignalingMessage) {
  const roomId = clientRooms.get(sender);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  // Send message to all other clients in the room
  room.clients.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

async function handleAIMode(ws: WebSocket, roomId: string) {
  try {
    // Check if Azure credentials are configured
    if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'AI mode not configured. Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.' 
      }));
      return;
    }

    // Create AI bot instance for this room
    const aiBot = new AIBot({
      speechKey: process.env.AZURE_SPEECH_KEY,
      speechRegion: process.env.AZURE_SPEECH_REGION,
      openaiKey: process.env.AZURE_OPENAI_KEY || '',
      openaiEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    });

    // Store AI bot instance
    aiBots.set(roomId, aiBot);

    // Start AI bot
    await aiBot.start(ws);

    // Send credentials to client for Speech SDK
    ws.send(JSON.stringify({ 
      type: 'ai-mode-active',
      speechKey: process.env.AZURE_SPEECH_KEY,
      speechRegion: process.env.AZURE_SPEECH_REGION
    }));

    console.log(`AI mode activated for room ${roomId}`);
  } catch (error) {
    console.error('Failed to start AI mode:', error);
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Failed to start AI mode' 
    }));
  }
}

async function handleAIText(ws: WebSocket, roomId: string, text: string) {
  const aiBot = aiBots.get(roomId);
  if (aiBot) {
    await aiBot.processTextInput(text);
  } else {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'AI bot not initialized' 
    }));
  }
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

// WebSocket endpoint info
app.get('/ws-info', (_req, res) => {
  res.json({ 
    wsEndpoint: '/ws',
    protocol: 'ws',
    port: PORT
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});