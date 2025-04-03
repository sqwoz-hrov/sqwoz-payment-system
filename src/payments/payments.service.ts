import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Payment,
  PaymentStatus,
  PaymentErrorReason,
} from './entities/payment.entity';
import { Refund, RefundStatus } from './entities/refund.entity';
import { CreatePaymentDto } from './dto/payment.dto';
import { CreateRefundDto, CancelRefundDto } from './dto/refund.dto';
import { Merchant } from '../merchants/entities/merchant.entity';
import { PaymentsGateway } from './payments.gateway';

enum WebsocketEventName {
  PAYMENT_UPDATE = 'payment_update',
  REFUND_UPDATE = 'refund_update',
}

@Injectable()
export class PaymentsService {
  private readonly paymentProcessingDelay: number;
  private readonly refundProcessingDelay: number;

  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(Refund)
    private refundsRepository: Repository<Refund>,
    private paymentsGateway: PaymentsGateway,
    private configService: ConfigService,
  ) {
    this.paymentProcessingDelay = this.configService.get<number>(
      'payments.processingDelays.payment',
      15000,
    );
    this.refundProcessingDelay = this.configService.get<number>(
      'payments.processingDelays.refund',
      30000,
    );
    console.log(
      `Payment processing delay: ${this.paymentProcessingDelay}ms`,
      `Refund processing delay: ${this.refundProcessingDelay}ms`,
    );
  }

  async create(
    createPaymentDto: CreatePaymentDto,
    merchant: Merchant,
  ): Promise<Payment> {
    const payment = this.paymentsRepository.create({
      ...createPaymentDto,
      merchant,
      merchantId: merchant.id,
      status: PaymentStatus.PROCESSING,
    });

    const savedPayment = await this.paymentsRepository.save(payment);

    // Simulate async payment processing
    this.processPayment(savedPayment);

    return savedPayment;
  }

  private async processPayment(payment: Payment): Promise<void> {
    // Simulate processing time using configured delay
    await new Promise((resolve) =>
      setTimeout(resolve, this.paymentProcessingDelay),
    );

    // Determine payment result based on card number
    let status = PaymentStatus.SUCCESSFUL;
    let errorReason = PaymentErrorReason.NONE;

    const cardPrefix = payment.cardNumber.replace(/\s/g, '').substring(0, 4);

    switch (cardPrefix) {
      case '1111':
        status = PaymentStatus.SUCCESSFUL;
        break;
      case '2222':
        status = PaymentStatus.FAILED;
        errorReason = PaymentErrorReason.INSUFFICIENT_BALANCE;
        break;
      case '3333':
        status = PaymentStatus.FAILED;
        errorReason = PaymentErrorReason.INCORRECT_CARD_DETAILS;
        break;
      case '4444':
        status = PaymentStatus.FAILED;
        errorReason = PaymentErrorReason.CARD_EXPIRED;
        break;
      default:
        status = PaymentStatus.SUCCESSFUL;
    }

    // Update payment status
    payment.status = status;
    payment.errorReason = errorReason;
    await this.paymentsRepository.save(payment);

    // Notify merchant via WebSocket
    this.paymentsGateway.notifyMerchant(
      payment.merchantId,
      WebsocketEventName.PAYMENT_UPDATE,
      {
        type: 'PAYMENT_UPDATE',
        paymentId: payment.id,
        status,
        errorReason,
      },
    );
  }

  async createRefund(
    createRefundDto: CreateRefundDto,
    merchantId: string,
  ): Promise<Refund> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: createRefundDto.paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.merchantId !== merchantId) {
      throw new BadRequestException('Payment does not belong to this merchant');
    }

    if (payment.status !== PaymentStatus.SUCCESSFUL) {
      throw new BadRequestException(
        'Cannot refund a payment that was not successful',
      );
    }

    const amount = createRefundDto.amount || payment.amount;

    const refund = this.refundsRepository.create({
      amount,
      payment,
      paymentId: payment.id,
      status: RefundStatus.PROCESSING,
    });

    const savedRefund = await this.refundsRepository.save(refund);

    // Process refund asynchronously
    this.processRefund(savedRefund);

    return savedRefund;
  }

  private async processRefund(refund: Refund): Promise<void> {
    // Simulate processing time using configured delay
    await new Promise((resolve) =>
      setTimeout(resolve, this.refundProcessingDelay),
    );

    // Check if refund was cancelled during processing
    const currentRefund = await this.refundsRepository.findOne({
      where: { id: refund.id },
      relations: ['payment'],
    });

    if (!currentRefund) {
      return;
    }

    if (currentRefund.status === RefundStatus.CANCELLED) {
      return;
    }

    // Update refund status based on payment status
    if (currentRefund.payment.status === PaymentStatus.SUCCESSFUL) {
      currentRefund.status = RefundStatus.SUCCESSFUL;
    } else {
      currentRefund.status = RefundStatus.FAILED;
    }

    await this.refundsRepository.save(currentRefund);

    // Notify merchant via WebSocket
    this.paymentsGateway.notifyMerchant(
      currentRefund.payment.merchantId,
      WebsocketEventName.REFUND_UPDATE,
      {
        type: 'REFUND_UPDATE',
        refundId: currentRefund.id,
        paymentId: currentRefund.paymentId,
        status: currentRefund.status,
      },
    );
  }

  async cancelRefund(
    cancelRefundDto: CancelRefundDto,
    merchantId: string,
  ): Promise<Refund> {
    const refund = await this.refundsRepository.findOne({
      where: { id: cancelRefundDto.refundId },
      relations: ['payment'],
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.payment.merchantId !== merchantId) {
      throw new BadRequestException('Refund does not belong to this merchant');
    }

    if (refund.status !== RefundStatus.PROCESSING) {
      throw new BadRequestException(
        'Cannot cancel a refund that is not in processing state',
      );
    }

    refund.status = RefundStatus.CANCELLED;
    const savedRefund = await this.refundsRepository.save(refund);

    this.paymentsGateway.notifyMerchant(
      refund.payment.merchantId,
      WebsocketEventName.REFUND_UPDATE,
      {
        type: 'REFUND_UPDATE',
        refundId: refund.id,
        paymentId: refund.paymentId,
        status: RefundStatus.CANCELLED,
      },
    );

    return savedRefund;
  }

  async findPaymentById(id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
      relations: ['refunds'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async findRefundById(id: string): Promise<Refund> {
    const refund = await this.refundsRepository.findOne({
      where: { id },
      relations: ['payment'],
    });

    if (!refund) {
      throw new NotFoundException(`Refund with ID ${id} not found`);
    }

    return refund;
  }
}
