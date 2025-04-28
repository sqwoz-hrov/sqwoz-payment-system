import {
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  OnGatewayInit,
} from '@nestjs/websockets';
import { WebSocket, Server } from 'ws';
import { MerchantsService } from '../merchants/merchants.service';
import * as url from 'url';
import { IncomingMessage } from 'http';
import { AuthService } from '../auth/auth.service';

interface WebSocketClient extends WebSocket {
  id: string;
  isAlive: boolean;
  data: {
    merchantId?: string;
  };
}

@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private merchantSockets: Map<string, Set<string>> = new Map();
  private clients: Map<string, WebSocketClient> = new Map();
  private pingInterval: NodeJS.Timeout;

  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly authService: AuthService,
  ) {
    // Generate unique IDs for each connection
    this.generateUniqueId = this.generateUniqueId.bind(this);
  }

  afterInit(server: Server) {
    console.log('WebSocket server initialized');

    // Set up ping/pong to detect disconnected clients
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client) => {
        if (client.isAlive === false) {
          this.handleDisconnect(client as any);
          return client.terminate();
        }

        client.isAlive = false;
        client.ping();
      });
    }, 30000);

    // Handle pong messages to keep connections alive
    server.on('pong', (client: WebSocketClient) => {
      client.isAlive = true;
    });
  }

  private generateUniqueId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  async handleConnection(client: WebSocket, request: IncomingMessage) {
    try {
      console.log('New client connected:', request.url);
      const wsClient = client as WebSocketClient;

      wsClient.id = this.generateUniqueId();
      wsClient.isAlive = true;
      wsClient.data = {};

      this.clients.set(wsClient.id, wsClient);

      const queryParams = url.parse(request.url || '', true).query;
      const token = queryParams.token as string;

      console.log('Token received:', token);
      if (!token) {
        this.sendMessage(wsClient, 'error', {
          message: 'Authentication token is required',
        });
        wsClient.terminate();
        return;
      }

      const { ok, payload, error } = this.authService.validateToken(token);
      if (!ok) {
        this.sendMessage(wsClient, 'error', {
          message: error,
        });
        wsClient.terminate();
        return;
      }

      const { merchantId, merchantKey } = payload;

      const merchant = await this.merchantsService.findByIdAndKey(
        merchantId,
        merchantKey,
      );

      console.log('Merchant found:', merchant);
      if (!merchant) {
        this.sendMessage(wsClient, 'error', {
          message: 'Invalid merchant credentials',
        });
        wsClient.terminate();
        return;
      }

      console.log('Merchant authenticated:', merchant);
      wsClient.data.merchantId = merchant.id;

      if (!this.merchantSockets.has(merchant.id)) {
        this.merchantSockets.set(merchant.id, new Set());
      }
      this.merchantSockets.get(merchant.id)!.add(wsClient.id);

      wsClient.on('message', (message: string) => {
        this.handleMessage(wsClient, message);
      });

      this.sendMessage(wsClient, 'connection_established', {
        message: 'Connected to payment system',
        merchantId: merchant.id,
      });
    } catch (error) {
      console.error('Error during connection:', error);
      const wsClient = client as WebSocketClient;
      this.sendMessage(wsClient, 'error', { message: 'Internal server error' });
      wsClient.terminate();
    }
  }

  handleDisconnect(client: WebSocket) {
    const wsClient = client as WebSocketClient;
    const merchantId = wsClient.data.merchantId;

    // Remove from clients map
    this.clients.delete(wsClient.id);

    if (merchantId && this.merchantSockets.has(merchantId)) {
      this.merchantSockets.get(merchantId)!.delete(wsClient.id);

      // Clean up if no more connections for this merchant
      if (this.merchantSockets.get(merchantId)!.size === 0) {
        this.merchantSockets.delete(merchantId);
      }
    }
  }

  handleMessage(client: WebSocketClient, rawMessage: string) {
    try {
      const message = JSON.parse(rawMessage.toString());

      // Handle different message types based on event property
      if (message.event && typeof message.event === 'string') {
        // Additional message handling logic can be added here
        console.log(`Received ${message.event} from ${client.data.merchantId}`);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      this.sendMessage(client, 'error', { message: 'Invalid message format' });
    }
  }

  // Send a message to a specific client
  private sendMessage(client: WebSocketClient, event: string, data: any) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }

  // Notify all sockets for a specific merchant
  notifyMerchant(merchantId: string, event: string, data: any) {
    if (this.merchantSockets.has(merchantId)) {
      const socketIds = this.merchantSockets.get(merchantId)!;
      for (const socketId of socketIds) {
        const client = this.clients.get(socketId);
        if (client) {
          this.sendMessage(client, event, data);
        }
      }
    }
  }

  // Clean up resources on module destruction
  onModuleDestroy() {
    clearInterval(this.pingInterval);
    this.clients.forEach((client) => client.terminate());
  }
}
