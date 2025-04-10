import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import { APP_CONFIG_KEY } from './config/app.config';
import { buildSwaggerDocs } from './swagger';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());

  const document = buildSwaggerDocs(app, app.get(ConfigService));
  app.useWebSocketAdapter(new WsAdapter(app));
  SwaggerModule.setup('api/docs', app, document);

  const PORT = app
    .get(ConfigService)
    .getOrThrow<number>(`${APP_CONFIG_KEY}.PORT`);
  await app.listen(PORT);
  console.log(`Application is running on: http://localhost:${PORT}`);
}
bootstrap();
