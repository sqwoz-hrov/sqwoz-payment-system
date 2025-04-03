import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsGateway } from './payments.gateway';
import { Payment } from './entities/payment.entity';
import { Refund } from './entities/refund.entity';
import { MerchantsModule } from '../merchants/merchants.module';
import paymentsConfig from './payments.config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Refund]),
    ConfigModule.forFeature(paymentsConfig),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '1h'),
        },
      }),
    }),
    MerchantsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsGateway],
})
export class PaymentsModule {}
