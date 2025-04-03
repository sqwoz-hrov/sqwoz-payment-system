import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { CreateRefundDto, CancelRefundDto } from './dto/refund.dto';
import { MerchantsService } from '../merchants/merchants.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { RefundResponseDto } from './dto/refund-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
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
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req,
  ) {
    const merchant = await this.merchantsService.findByIdAndKey(
      req.user.merchantId,
      req.user.merchantKey,
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
  async createRefund(@Body() createRefundDto: CreateRefundDto, @Request() req) {
    const merchant = await this.merchantsService.findByIdAndKey(
      req.user.merchantId,
      req.user.merchantKey,
    );
    if (!merchant) {
      throw new UnauthorizedException('Invalid merchant credentials');
    }
    return this.paymentsService.createRefund(createRefundDto, merchant.id);
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
  async cancelRefund(@Body() cancelRefundDto: CancelRefundDto, @Request() req) {
    const merchant = await this.merchantsService.findByIdAndKey(
      req.user.merchantId,
      req.user.merchantKey,
    );
    if (!merchant) {
      throw new UnauthorizedException('Invalid merchant credentials');
    }
    return this.paymentsService.cancelRefund(cancelRefundDto, merchant.id);
  }
}
