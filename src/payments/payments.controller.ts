import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { CreateRefundDto, CancelRefundDto } from './dto/refund.dto';
import { MerchantsService } from '../merchants/merchants.service';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { RefundResponseDto } from './dto/refund-response.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly merchantsService: MerchantsService,
  ) {}

  @ApiOperation({ summary: 'Create a new payment' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({
    status: 201,
    description: 'Payment successfully created.',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid merchant credentials.' })
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

  @ApiOperation({ summary: 'Create a refund for a payment' })
  @ApiBody({ type: CreateRefundDto })
  @ApiResponse({
    status: 201,
    description: 'Refund successfully created.',
    type: RefundResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid merchant credentials.' })
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

  @ApiOperation({ summary: 'Cancel a refund request' })
  @ApiBody({ type: CancelRefundDto })
  @ApiResponse({
    status: 200,
    description: 'Refund successfully canceled.',
    type: RefundResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid merchant credentials.' })
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
