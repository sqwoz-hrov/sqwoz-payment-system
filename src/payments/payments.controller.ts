import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { CreateRefundDto, CancelRefundDto } from './dto/refund.dto';
import { MerchantsService } from '../merchants/merchants.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly merchantsService: MerchantsService,
  ) {}

  @Post()
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    const merchant = await this.merchantsService.findByIdAndKey(
      createPaymentDto.merchantId,
      createPaymentDto.merchantKey,
    );

    if (!merchant) {
      throw new UnauthorizedException('Invalid merchant credentials');
    }

    return this.paymentsService.create(createPaymentDto, merchant);
  }

  @Post('refund')
  async createRefund(@Body() createRefundDto: CreateRefundDto) {
    const merchant = await this.merchantsService.findByIdAndKey(
      createRefundDto.merchantId,
      createRefundDto.merchantKey,
    );

    if (!merchant) {
      throw new UnauthorizedException('Invalid merchant credentials');
    }

    return this.paymentsService.createRefund(createRefundDto);
  }

  @Post('refund/cancel')
  async cancelRefund(@Body() cancelRefundDto: CancelRefundDto) {
    const merchant = await this.merchantsService.findByIdAndKey(
      cancelRefundDto.merchantId,
      cancelRefundDto.merchantKey,
    );

    if (!merchant) {
      throw new UnauthorizedException('Invalid merchant credentials');
    }

    return this.paymentsService.cancelRefund(cancelRefundDto);
  }
}
