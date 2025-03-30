import { ApiProperty } from '@nestjs/swagger';
import { RefundStatus } from '../entities/refund.entity';

export class RefundResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: RefundStatus })
  status: RefundStatus;

  @ApiProperty()
  paymentId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
