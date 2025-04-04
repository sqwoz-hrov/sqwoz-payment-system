import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from './payments/payments.module';
import { MerchantsModule } from './merchants/merchants.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AsyncApiModule } from './asyncapi/asyncapi.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow('DB_HOST', 'localhost'),
        port: configService.getOrThrow<number>('DB_PORT', 5432),
        username: configService.getOrThrow('DB_USERNAME', 'postgres'),
        password: configService.getOrThrow('DB_PASSWORD', 'postgres'),
        database: configService.getOrThrow('DB_DATABASE', 'payment_system'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<boolean>('DB_SYNC', false), // Should be false in production
      }),
    }),
    PaymentsModule,
    MerchantsModule,
    AuthModule,
    AsyncApiModule,
  ],
})
export class AppModule {}
