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
