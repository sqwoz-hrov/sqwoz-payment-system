import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsGateway } from './payments.gateway';
import { Payment } from './entities/payment.entity';
import { Refund } from './entities/refund.entity';
import { MerchantsModule } from '../merchants/merchants.module';
import paymentsConfig from './payments.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Refund]),
    ConfigModule.forFeature(paymentsConfig),
    MerchantsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsGateway],
})
export class PaymentsModule {}
