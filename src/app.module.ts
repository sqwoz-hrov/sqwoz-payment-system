import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from './payments/payments.module';
import { MerchantsModule } from './merchants/merchants.module';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { AsyncApiModule } from './asyncapi/asyncapi.module';
import { AuthModule } from './auth/auth.module';
import { appConfig } from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => ({
        type: 'postgres',
        host: config.DB_HOST,
        port: config.DB_PORT,
        username: config.DB_USERNAME,
        password: config.DB_PASSWORD,
        database: config.DB_DATABASE,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.DB_SYNC, // Should be false in production
      }),
    }),
    PaymentsModule,
    MerchantsModule,
    AuthModule,
    AsyncApiModule,
  ],
})
export class AppModule {}
