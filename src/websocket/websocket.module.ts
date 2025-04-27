import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { MerchantsModule } from '../merchants/merchants.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [MerchantsModule, AuthModule],
  providers: [WebsocketGateway],
  controllers: [],
  exports: [WebsocketGateway],
})
export class WebSocketModule {}
