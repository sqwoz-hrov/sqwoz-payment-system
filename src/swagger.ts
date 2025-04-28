import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_CONFIG_KEY } from './config/app.config';

export const buildSwaggerDocs = (
  app: INestApplication,
  configService: ConfigService,
) => {
  const serverUrl = configService.get(`${APP_CONFIG_KEY}.SERVER_URL`);

  const config = new DocumentBuilder()
    .setTitle('Skvoz Payment System')
    .setDescription('API documentation for the Skvoz Payment System')
    .addServer(serverUrl)
    .addBearerAuth()
    .setVersion('0.0.2')
    .addTag('Payments')
    .build();

  return SwaggerModule.createDocument(app, config);
};
