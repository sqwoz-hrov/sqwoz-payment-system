import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from '../src/merchants/entities/merchant.entity';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const merchantsRepository = app.get<Repository<Merchant>>(
    getRepositoryToken(Merchant),
  );

  // Create test merchant
  const testMerchant = merchantsRepository.create({
    name: 'Test Merchant',
    key: 'test-secret-key',
  });

  const savedMerchant = await merchantsRepository.save(testMerchant);

  console.log('Test merchant created:');
  console.log(`ID: ${savedMerchant.id}`);
  console.log(`Key: ${savedMerchant.key}`);

  await app.close();
}

bootstrap();
