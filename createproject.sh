#!/bin/bash

# Create directory structure
mkdir -p src/payments/dto src/payments/entities src/merchants/entities

# Create main.ts
cat > src/main.ts << 'EOF'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
  console.log('Application is running on: http://localhost:3000');
}
bootstrap();
EOF

# Create app.module.ts
cat > src/app.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from './payments/payments.module';
import { MerchantsModule } from './merchants/merchants.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'payments.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // Only for development!
    }),
    PaymentsModule,
    MerchantsModule,
  ],
})
export class AppModule {}
EOF

# Create merchant.entity.ts
cat > src/merchants/entities/merchant.entity.ts << 'EOF'
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Payment } from '../../payments/entities/payment.entity';

@Entity()
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  key: string;

  @OneToMany(() => Payment, payment => payment.merchant)
  payments: Payment[];
}
EOF

# Create merchants.module.ts
cat > src/merchants/merchants.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Merchant } from './entities/merchant.entity';
import { MerchantsService } from './merchants.service';

@Module({
  imports: [TypeOrmModule.forFeature([Merchant])],
  providers: [MerchantsService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
EOF

# Create merchants.service.ts
cat > src/merchants/merchants.service.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from './entities/merchant.entity';

@Injectable()
export class MerchantsService {
  constructor(
    @InjectRepository(Merchant)
    private merchantsRepository: Repository<Merchant>,
  ) {}

  async findByIdAndKey(merchantId: string, merchantKey: string): Promise<Merchant | null> {
    return this.merchantsRepository.findOne({
      where: {
        id: merchantId,
        key: merchantKey,
      },
    });
  }

  // Additional methods for managing merchants would go here
}
EOF

# Create payment.entity.ts
cat > src/payments/entities/payment.entity.ts << 'EOF'
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { Refund } from './refund.entity';

export enum PaymentStatus {
  PROCESSING = 'processing',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
}

export enum PaymentErrorReason {
  NONE = 'none',
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  INCORRECT_CARD_DETAILS = 'incorrect_card_details',
  CARD_EXPIRED = 'card_expired',
}

@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  amount: number;

  @Column()
  cardNumber: string;

  @Column()
  cardholderName: string;

  @Column()
  expiryDate: string;

  @Column()
  cvv: string;

  @Column({
    type: 'simple-enum',
    enum: PaymentStatus,
    default: PaymentStatus.PROCESSING,
  })
  status: PaymentStatus;

  @Column({
    type: 'simple-enum',
    enum: PaymentErrorReason,
    default: PaymentErrorReason.NONE,
  })
  errorReason: PaymentErrorReason;

  @ManyToOne(() => Merchant, merchant => merchant.payments)
  merchant: Merchant;

  @Column()
  merchantId: string;

  @OneToMany(() => Refund, refund => refund.payment)
  refunds: Refund[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
EOF

# Create refund.entity.ts
cat > src/payments/entities/refund.entity.ts << 'EOF'
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Payment } from './payment.entity';

export enum RefundStatus {
  PROCESSING = 'processing',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity()
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  amount: number;

  @Column({
    type: 'simple-enum',
    enum: RefundStatus,
    default: RefundStatus.PROCESSING,
  })
  status: RefundStatus;

  @ManyToOne(() => Payment, payment => payment.refunds)
  payment: Payment;

  @Column()
  paymentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
EOF

# Create payment.dto.ts
cat > src/payments/dto/payment.dto.ts << 'EOF'
import { IsNotEmpty, IsNumber, IsString, MinLength, MaxLength } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsString()
  merchantId: string;

  @IsNotEmpty()
  @IsString()
  merchantKey: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsString()
  @MinLength(16)
  @MaxLength(19)
  cardNumber: string;

  @IsNotEmpty()
  @IsString()
  cardholderName: string;

  @IsNotEmpty()
  @IsString()
  expiryDate: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(4)
  cvv: string;
}
EOF

# Create refund.dto.ts
cat > src/payments/dto/refund.dto.ts << 'EOF'
import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateRefundDto {
  @IsNotEmpty()
  @IsString()
  paymentId: string;

  @IsNotEmpty()
  @IsString()
  merchantId: string;

  @IsNotEmpty()
  @IsString()
  merchantKey: string;

  @IsOptional()
  @IsNumber()
  amount?: number; // Optional, defaults to full payment amount if not provided
}

export class CancelRefundDto {
  @IsNotEmpty()
  @IsString()
  refundId: string;

  @IsNotEmpty()
  @IsString()
  merchantId: string;

  @IsNotEmpty()
  @IsString()
  merchantKey: string;
}
EOF

# Create payments.module.ts
cat > src/payments/payments.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsGateway } from './payments.gateway';
import { Payment } from './entities/payment.entity';
import { Refund } from './entities/refund.entity';
import { MerchantsModule } from '../merchants/merchants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Refund]),
    MerchantsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsGateway],
})
export class PaymentsModule {}
EOF

# Create payments.controller.ts
cat > src/payments/payments.controller.ts << 'EOF'
import { Controller, Post, Body, BadRequestException, UnauthorizedException } from '@nestjs/common';
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
EOF

# Create payments.service.ts
cat > src/payments/payments.service.ts << 'EOF'
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentErrorReason } from './entities/payment.entity';
import { Refund, RefundStatus } from './entities/refund.entity';
import { CreatePaymentDto } from './dto/payment.dto';
import { CreateRefundDto, CancelRefundDto } from './dto/refund.dto';
import { Merchant } from '../merchants/entities/merchant.entity';
import { PaymentsGateway } from './payments.gateway';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(Refund)
    private refundsRepository: Repository<Refund>,
    private paymentsGateway: PaymentsGateway,
  ) {}

  async create(createPaymentDto: CreatePaymentDto, merchant: Merchant): Promise<Payment> {
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
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 15000));

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
    this.paymentsGateway.notifyMerchant(payment.merchantId, {
      type: 'PAYMENT_UPDATE',
      paymentId: payment.id,
      status,
      errorReason,
    });
  }

  async createRefund(createRefundDto: CreateRefundDto): Promise<Refund> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: createRefundDto.paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.merchantId !== createRefundDto.merchantId) {
      throw new BadRequestException('Payment does not belong to this merchant');
    }

    if (payment.status !== PaymentStatus.SUCCESSFUL) {
      throw new BadRequestException('Cannot refund a payment that was not successful');
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
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 30000));

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
    this.paymentsGateway.notifyMerchant(currentRefund.payment.merchantId, {
      type: 'REFUND_UPDATE',
      refundId: currentRefund.id,
      paymentId: currentRefund.paymentId,
      status: currentRefund.status,
    });
  }

  async cancelRefund(cancelRefundDto: CancelRefundDto): Promise<Refund> {
    const refund = await this.refundsRepository.findOne({
      where: { id: cancelRefundDto.refundId },
      relations: ['payment'],
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.payment.merchantId !== cancelRefundDto.merchantId) {
      throw new BadRequestException('Refund does not belong to this merchant');
    }

    if (refund.status !== RefundStatus.PROCESSING) {
      throw new BadRequestException('Cannot cancel a refund that is not in processing state');
    }

    refund.status = RefundStatus.CANCELLED;
    const savedRefund = await this.refundsRepository.save(refund);

    // Notify merchant via WebSocket
    this.paymentsGateway.notifyMerchant(refund.payment.merchantId, {
      type: 'REFUND_UPDATE',
      refundId: refund.id,
      paymentId: refund.paymentId,
      status: RefundStatus.CANCELLED,
    });

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
EOF

# Create payments.gateway.ts
cat > src/payments/payments.gateway.ts << 'EOF'
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MerchantsService } from '../merchants/merchants.service';

interface ConnectionParams {
  merchant_id: string;
  merchant_key: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class PaymentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private merchantSockets: Map<string, Set<string>> = new Map();

  constructor(private readonly merchantsService: MerchantsService) {}

  async handleConnection(client: Socket) {
    try {
      const params = client.handshake.query as unknown as ConnectionParams;
      
      if (!params.merchant_id || !params.merchant_key) {
        client.disconnect();
        return;
      }

      const merchant = await this.merchantsService.findByIdAndKey(
        params.merchant_id,
        params.merchant_key,
      );

      if (!merchant) {
        client.disconnect();
        return;
      }

      // Store connection
      client.data.merchantId = merchant.id;

      // Add socket to merchant's set
      if (!this.merchantSockets.has(merchant.id)) {
        this.merchantSockets.set(merchant.id, new Set());
      }
      this.merchantSockets.get(merchant.id).add(client.id);

      // Send confirmation
      client.emit('connection_established', {
        message: 'Connected to payment system',
        merchantId: merchant.id,
      });
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const merchantId = client.data.merchantId;
    if (merchantId && this.merchantSockets.has(merchantId)) {
      this.merchantSockets.get(merchantId).delete(client.id);
      
      // Clean up if no more connections for this merchant
      if (this.merchantSockets.get(merchantId).size === 0) {
        this.merchantSockets.delete(merchantId);
      }
    }
  }

  notifyMerchant(merchantId: string, data: any) {
    if (this.merchantSockets.has(merchantId)) {
      const socketIds = this.merchantSockets.get(merchantId);
      for (const socketId of socketIds) {
        this.server.to(socketId).emit('payment_update', data);
      }
    }
  }
}
EOF

echo "Project structure created successfully!"
echo "To make the script executable, run: chmod +x create-project.sh"
echo "Then run it with: ./create-project.sh"