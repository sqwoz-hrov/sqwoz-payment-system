import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateRefundDto {
  @ApiProperty({
    description: 'ID of the payment to refund',
    example: 'payment_abc123',
  })
  @IsNotEmpty()
  @IsString()
  paymentId: string;

  @ApiPropertyOptional({
    description: 'Amount to refund (optional, full amount if not provided)',
    example: 500,
  })
  @IsOptional()
  @IsNumber()
  amount?: number;
}

export class CancelRefundDto {
  @ApiProperty({
    description: 'ID of the refund to cancel',
    example: 'refund_xyz789',
  })
  @IsNotEmpty()
  @IsString()
  refundId: string;
}
