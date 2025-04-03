import { ApiProperty } from '@nestjs/swagger';

class MerchantInfo {
  @ApiProperty({
    description: 'The unique ID of the merchant',
    example: 'merch_123456',
  })
  id: string;

  @ApiProperty({
    description: 'The name of the merchant',
    example: 'Acme Corp',
  })
  name: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token for API authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'Basic merchant information',
    type: MerchantInfo,
  })
  merchant: MerchantInfo;
}
