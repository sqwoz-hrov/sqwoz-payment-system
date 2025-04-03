import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Payment amount',
    example: 1000,
  })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Card number (16 to 19 digits)',
    example: '4111111111111111',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(16)
  @MaxLength(19)
  cardNumber: string;

  @ApiProperty({
    description: 'Cardholder full name',
    example: 'JOHN DOE',
  })
  @IsNotEmpty()
  @IsString()
  cardholderName: string;

  @ApiProperty({
    description: 'Card expiry date in MM/YY format',
    example: '12/25',
  })
  @IsNotEmpty()
  @IsString()
  expiryDate: string;

  @ApiProperty({
    description: 'Card CVV code (3 to 4 digits)',
    example: '123',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(4)
  cvv: string;
}
