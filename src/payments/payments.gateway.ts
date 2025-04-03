import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MerchantsService } from '../merchants/merchants.service';
import { JwtService } from '@nestjs/jwt';

interface ConnectionParams {
  token: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class PaymentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  private merchantSockets: Map<string, Set<string>> = new Map();

  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const params = client.handshake.auth as ConnectionParams;

      // Check if token is provided
      if (!params.token) {
        client.emit('error', { message: 'Authentication token is required' });
        client.disconnect();
        return;
      }

      // Verify and decode the JWT token
      let payload;
      try {
        payload = this.jwtService.verify(params.token);
      } catch (error) {
        console.log('Token verification error:', error);
        client.emit('error', { message: 'Invalid or expired token' });
        client.disconnect();
        return;
      }

      const { merchantId, merchantKey } = payload;

      // Verify the merchant exists
      const merchant = await this.merchantsService.findByIdAndKey(
        merchantId,
        merchantKey,
      );

      if (!merchant) {
        client.emit('error', { message: 'Invalid merchant credentials' });
        client.disconnect();
        return;
      }

      // Store connection info
      client.data.merchantId = merchant.id;

      // Add socket to merchant's set
      if (!this.merchantSockets.has(merchant.id)) {
        this.merchantSockets.set(merchant.id, new Set());
      }
      this.merchantSockets.get(merchant.id)!.add(client.id);

      // Send confirmation
      client.emit('connection_established', {
        message: 'Connected to payment system',
        merchantId: merchant.id,
      });
    } catch (error) {
      console.error('Error during connection:', error);
      client.emit('error', { message: 'Internal server error' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const merchantId = client.data.merchantId;
    if (merchantId && this.merchantSockets.has(merchantId)) {
      this.merchantSockets.get(merchantId)!.delete(client.id);
      // Clean up if no more connections for this merchant
      if (this.merchantSockets.get(merchantId)!.size === 0) {
        this.merchantSockets.delete(merchantId);
      }
    }
  }

  notifyMerchant(merchantId: string, event_name: string, data: any) {
    if (this.merchantSockets.has(merchantId)) {
      const socketIds = this.merchantSockets.get(merchantId)!;
      for (const socketId of socketIds) {
        this.server.to(socketId).emit(event_name, data);
      }
    }
  }
}
