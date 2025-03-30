import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, PaymentErrorReason } from '../entities/payment.entity';

export class PaymentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  cardNumber: string;

  @ApiProperty()
  cardholderName: string;

  @ApiProperty()
  expiryDate: string;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ enum: PaymentErrorReason })
  errorReason: PaymentErrorReason;

  @ApiProperty()
  merchantId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
