import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_CONFIG_KEY } from './config/app.config';

const pickServer = (env: string, port: number) => {
  if (env === 'production') {
    return ['https://stage.sqwoz-hrov.ru/payments', 'Sqwoz Staging'];
  }

  return [`http://localhost:${port}/`, 'Local server'];
};

export const buildSwaggerDocs = (
  app: INestApplication,
  configService: ConfigService,
) => {
  const containerPort = configService.get(`${APP_CONFIG_KEY}.PORT`);
  const env = configService.get(`${APP_CONFIG_KEY}.ENV`);
  const [serverUrl, serverDescription] = pickServer(env, containerPort);

  const config = new DocumentBuilder()
    .setTitle('Skvoz Payment System')
    .setDescription('API documentation for the Skvoz Payment System')
    .addServer(serverUrl, serverDescription)
    .addBearerAuth()
    .setVersion('0.0.2')
    .addTag('Payments')
    .build();

  return SwaggerModule.createDocument(app, config);
};
