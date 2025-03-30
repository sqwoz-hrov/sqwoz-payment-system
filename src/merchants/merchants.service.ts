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

  async findByIdAndKey(
    merchantId: string,
    merchantKey: string,
  ): Promise<Merchant | null> {
    return this.merchantsRepository.findOne({
      where: {
        id: merchantId,
        key: merchantKey,
      },
    });
  }

  // Additional methods for managing merchants would go here
}
