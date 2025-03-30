import { Module } from '@nestjs/common';
import { AsyncApiController } from './asyncapi.controller';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public', 'asyncapi'),
      serveRoot: '/asyncapi',
      serveStaticOptions: {
        index: false,
      },
    }),
  ],
  controllers: [AsyncApiController],
})
export class AsyncApiModule {}
