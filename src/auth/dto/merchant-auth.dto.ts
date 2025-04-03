import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MerchantAuthDto {
  @ApiProperty({
    description: 'The unique ID of the merchant',
    example: 'merch_123456',
  })
  @IsNotEmpty()
  @IsString()
  merchantId: string;

  @ApiProperty({
    description: 'API key for the merchant',
    example: 'key_abcdef1234567890',
  })
  @IsNotEmpty()
  @IsString()
  merchantKey: string;
}