interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';
  roomId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export class WebRTCClient {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private roomId: string | null = null;

  constructor(
    private signalingServerUrl: string,
    private onStatusChange: (status: string) => void,
    private onRemoteStream: (stream: MediaStream) => void
  ) {}

  async connect(roomId: string): Promise<void> {
    this.roomId = roomId;
    
    // Get user media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
    } catch (error) {
      console.error('Failed to get user media:', error);
      this.onStatusChange('Failed to access microphone');
      throw error;
    }

    // Connect to signaling server
    console.log('Connecting to signaling server:', this.signalingServerUrl);
    this.ws = new WebSocket(this.signalingServerUrl);
    
    this.ws.onopen = () => {
      console.log('Connected to signaling server');
      this.onStatusChange('Connected to server');
      this.sendSignal({ type: 'join', roomId });
    };

    this.ws.onmessage = async (event) => {
      const message: SignalingMessage = JSON.parse(event.data);
      await this.handleSignalingMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.onStatusChange('Connection error');
      // Add more detailed error logging
      console.error('WebSocket URL:', this.signalingServerUrl);
      console.error('WebSocket readyState:', this.ws?.readyState);
    };

    this.ws.onclose = (event) => {
      console.log('Disconnected from signaling server');
      console.log('Close code:', event.code, 'reason:', event.reason);
      this.onStatusChange('Disconnected');
    };
  }

  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    console.log('Received signaling message:', message);
    switch (message.type) {
      case 'join':
        // Another user joined, we are the initiator
        console.log('Another user joined, creating offer');
        await this.createPeerConnection();
        await this.createOffer();
        break;

      case 'offer':
        // Received offer, create answer
        if (!this.pc) {
          await this.createPeerConnection();
        }
        await this.pc!.setRemoteDescription(new RTCSessionDescription(message.offer!));
        const answer = await this.pc!.createAnswer();
        await this.pc!.setLocalDescription(answer);
        this.sendSignal({ type: 'answer', answer: answer });
        break;

      case 'answer':
        // Received answer
        await this.pc!.setRemoteDescription(new RTCSessionDescription(message.answer!));
        break;

      case 'ice-candidate':
        // Received ICE candidate
        if (message.candidate) {
          await this.pc!.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
        break;

      case 'leave':
        // Other user left
        this.hangup();
        break;
    }
  }

  private async createPeerConnection(): Promise<void> {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };

    this.pc = new RTCPeerConnection(configuration);

    // Add local stream tracks
    this.localStream!.getTracks().forEach(track => {
      this.pc!.addTrack(track, this.localStream!);
    });

    // Handle remote stream
    this.pc.ontrack = (event) => {
      console.log('Received remote track');
      if (event.streams[0]) {
        this.onRemoteStream(event.streams[0]);
        this.onStatusChange('Connected');
      }
    };

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON()
        });
      }
    };

    // Handle connection state changes
    this.pc.onconnectionstatechange = () => {
      console.log('Connection state:', this.pc!.connectionState);
      switch (this.pc!.connectionState) {
        case 'connecting':
          this.onStatusChange('Connecting...');
          break;
        case 'connected':
          this.onStatusChange('Connected');
          break;
        case 'disconnected':
        case 'failed':
          this.onStatusChange('Disconnected');
          break;
      }
    };
  }

  private async createOffer(): Promise<void> {
    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    this.sendSignal({ type: 'offer', offer: offer });
  }

  private sendSignal(message: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...message, roomId: this.roomId }));
    }
  }

  hangup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.ws) {
      this.sendSignal({ type: 'leave' });
      this.ws.close();
      this.ws = null;
    }

    this.onStatusChange('Disconnected');
  }
}