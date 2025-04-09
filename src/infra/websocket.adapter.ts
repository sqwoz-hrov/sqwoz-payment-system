import { INestApplicationContext, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessageMappingProperties } from '@nestjs/websockets';
import { WsAdapter } from '@nestjs/platform-ws';
import * as WebSocket from 'ws';
import { Observable, fromEvent, EMPTY } from 'rxjs';
import { mergeMap, filter } from 'rxjs/operators';
import { parse } from 'node:url';

export class AuthenticatedWsAdapter extends WsAdapter {
  readonly logger = new Logger(AuthenticatedWsAdapter.name);
  private readonly jwtService: JwtService;

  constructor(appOrHttpServer: INestApplicationContext) {
    super(appOrHttpServer);
    // Get the JwtService from the NestJS context
    this.jwtService = appOrHttpServer.get(JwtService);
  }

  create(port: number, options?: WebSocket.ServerOptions): any {
    const server: WebSocket = super.create(port, options);
    server.on('connection', (socket, request) =>
      this.handleConnection(socket, request),
    );
    return server;
  }

  bindClientConnect(): void {
    // This method is intentionally left empty as we handle
    // connections in our own 'connection' handler
  }

  async handleConnection(client: WebSocket, request: any): Promise<void> {
    try {
      const { query } = parse(request.url, true);
      const token = query.token as string;

      if (!token) {
        this.logger.error('No token provided');
        client.close(1008, 'Unauthorized');
        return;
      }

      try {
        // Verify the token
        const payload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET,
        });

        // Attach user info to the client
        (client as any).user = payload;

        this.logger.log(`Client authenticated: ${payload.merchantId}`);
      } catch (error) {
        this.logger.error(`Invalid token: ${error.message}`);
        client.close(1008, 'Invalid token');
      }
    } catch (error) {
      this.logger.error(`Error during connection: ${error.message}`);
      client.close(1011, 'Server error');
    }
  }

  // Override the bindMessageHandlers to use our authenticated client
  bindMessageHandlers(
    client: WebSocket,
    handlers: MessageMappingProperties[],
    transform: (data: any) => Observable<any>,
  ): void {
    // Check if client is authenticated
    if (!(client as any).user) {
      this.logger.error('Unauthenticated client tried to send a message');
      client.close(1008, 'Unauthorized');
      return;
    }

    fromEvent(client, 'message')
      .pipe(
        mergeMap((data: any) =>
          this.handleMessage(client, data, handlers, transform),
        ),
        filter((result) => result),
      )
      .subscribe((response) => client.send(JSON.stringify(response)));
  }

  private async handleMessage(
    client: WebSocket,
    message: any,
    handlers: MessageMappingProperties[],
    transform: (data: any) => Observable<any>,
  ): Promise<Observable<any>> {
    try {
      const messageString = message.data.toString();
      const messageData = JSON.parse(messageString);
      const pattern = messageData.event;

      // Add user data to the message payload
      messageData.user = (client as any).user;

      const handler = handlers.find((handler) => handler.message === pattern);

      if (!handler) {
        return EMPTY;
      }

      return transform(await handler.callback(messageData.data));
    } catch (error) {
      this.logger.error(`Error handling message: ${error.message}`);
      return EMPTY;
    }
  }
}
