import {
  IsNotEmpty,
  IsNumber,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

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
