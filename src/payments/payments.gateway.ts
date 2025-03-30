import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MerchantsService } from '../merchants/merchants.service';

interface ConnectionParams {
  merchant_id: string;
  merchant_key: string;
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

  constructor(private readonly merchantsService: MerchantsService) {}

  async handleConnection(client: Socket) {
    try {
      const params = client.handshake.query as unknown as ConnectionParams;

      if (!params.merchant_id || !params.merchant_key) {
        client.disconnect();
        return;
      }

      const merchant = await this.merchantsService.findByIdAndKey(
        params.merchant_id,
        params.merchant_key,
      );

      if (!merchant) {
        client.disconnect();
        return;
      }

      // Store connection
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
