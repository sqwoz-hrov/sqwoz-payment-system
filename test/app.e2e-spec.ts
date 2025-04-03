import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Socket, io } from 'socket.io-client';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Merchant } from '../src/merchants/entities/merchant.entity';
import { PaymentStatus } from '../src/payments/entities/payment.entity';
import { RefundStatus } from '../src/payments/entities/refund.entity';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

describe('PaymentSystem (e2e)', () => {
  let app: INestApplication;
  let merchantsRepository: Repository<Merchant>;
  let dataSource: DataSource;
  let configService: ConfigService;
  let jwtService: JwtService;

  let testMerchant: Merchant;
  let socket: Socket;
  let testPaymentId: string;
  let testRefundId: string;
  let jwtToken: string;

  // Configuration timeouts
  let paymentProcessingDelay: number;
  let refundProcessingDelay: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    await app.listen(3000);

    merchantsRepository = moduleFixture.get<Repository<Merchant>>(
      getRepositoryToken(Merchant),
    );
    dataSource = moduleFixture.get<DataSource>(DataSource);
    configService = moduleFixture.get<ConfigService>(ConfigService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Get the configured delays from ConfigService
    paymentProcessingDelay = configService.get<number>(
      'payments.processingDelays.payment',
    )!;
    refundProcessingDelay = configService.get<number>(
      'payments.processingDelays.refund',
    )!;

    console.log(
      `Using configured delays - Payment: ${paymentProcessingDelay}ms, Refund: ${refundProcessingDelay}ms`,
    );

    testMerchant = merchantsRepository.create({
      name: 'Test Merchant',
      key: 'test-secret-key',
    });
    await merchantsRepository.save(testMerchant);

    // Generate JWT token for the test merchant
    jwtToken = jwtService.sign({
      merchantId: testMerchant.id,
      merchantKey: testMerchant.key,
    });
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await app.close();
  });

  describe('Authentication', () => {
    it('should authenticate and get a JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          merchantId: testMerchant.id,
          merchantKey: testMerchant.key,
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('merchant');
      expect(response.body.merchant.id).toBe(testMerchant.id);

      // Update the token with the one received from the auth endpoint
      jwtToken = response.body.access_token;
    });
  });

  describe('WebSocket Connection', () => {
    it('should connect to WebSocket with JWT token', (done) => {
      socket = io(`http://localhost:3000`, {
        auth: {
          token: jwtToken,
        },
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        done();
      });

      socket.on('connect_error', (err) => {
        done.fail(`Failed to connect: ${err.message}`);
      });
    });

    it('should receive connection established event', (done) => {
      socket.on('connection_established', (data) => {
        expect(data.merchantId).toBe(testMerchant.id);
        expect(data.message).toBe('Connected to payment system');
        done();
      });
    });
  });

  describe('Payment Processing', () => {
    it('should create a successful payment and receive success notification', async () => {
      const paymentData = {
        amount: 100,
        cardNumber: '1111 1111 1111 1111',
        cardholderName: 'Test User',
        expiryDate: '12/25',
        cvv: '123',
      };

      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(paymentData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe(PaymentStatus.PROCESSING);

      testPaymentId = response.body.id;

      // Wait for the websocket event
      return new Promise<void>((resolve, reject) => {
        const handler = (data) => {
          if (
            data.paymentId === testPaymentId &&
            data.status === PaymentStatus.SUCCESSFUL
          ) {
            expect(data.type).toBe('PAYMENT_UPDATE');
            expect(data.errorReason).toBe('none');
            socket.off('payment_update', handler); // Remove listener to avoid interference
            resolve();
          }
        };

        socket.on('payment_update', handler);

        // Set timeout based on configured delay plus a buffer
        setTimeout(() => {
          socket.off('payment_update', handler);
          reject(
            new Error('Timed out waiting for successful payment notification'),
          );
        }, paymentProcessingDelay + 1000);
      });
    }); // Adjust the test timeout to accommodate the configured delay

    it('should create a failed payment due to insufficient balance and receive failure notification', async () => {
      const paymentData = {
        amount: 100,
        cardNumber: '2222 2222 2222 2222',
        cardholderName: 'Test User',
        expiryDate: '12/25',
        cvv: '123',
      };

      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(paymentData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe(PaymentStatus.PROCESSING);

      const failedPaymentId = response.body.id;

      // Wait for the websocket event
      return new Promise<void>((resolve, reject) => {
        const handler = (data) => {
          if (
            data.paymentId === failedPaymentId &&
            data.status === PaymentStatus.FAILED
          ) {
            expect(data.type).toBe('PAYMENT_UPDATE');
            expect(data.errorReason).toBe('insufficient_balance');
            socket.off('payment_update', handler);
            resolve();
          }
        };

        socket.on('payment_update', handler);

        setTimeout(() => {
          socket.off('payment_update', handler);
          reject(
            new Error(
              'Timed out waiting for insufficient balance failure notification',
            ),
          );
        }, paymentProcessingDelay + 1000);
      });
    });

    it('should create a failed payment due to incorrect card details and receive failure notification', async () => {
      const paymentData = {
        amount: 100,
        cardNumber: '3333 3333 3333 3333',
        cardholderName: 'Test User',
        expiryDate: '12/25',
        cvv: '123',
      };

      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(paymentData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe(PaymentStatus.PROCESSING);

      const failedPaymentId = response.body.id;

      // Wait for the websocket event
      return new Promise<void>((resolve, reject) => {
        const handler = (data) => {
          if (
            data.paymentId === failedPaymentId &&
            data.status === PaymentStatus.FAILED
          ) {
            expect(data.type).toBe('PAYMENT_UPDATE');
            expect(data.errorReason).toBe('incorrect_card_details');
            socket.off('payment_update', handler);
            resolve();
          }
        };

        socket.on('payment_update', handler);

        setTimeout(() => {
          socket.off('payment_update', handler);
          reject(
            new Error(
              'Timed out waiting for invalid card failure notification',
            ),
          );
        }, paymentProcessingDelay + 1000);
      });
    });

    it('should create a failed payment due to expired card and receive failure notification', async () => {
      const paymentData = {
        amount: 100,
        cardNumber: '4444 4444 4444 4444',
        cardholderName: 'Test User',
        expiryDate: '12/25',
        cvv: '123',
      };

      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(paymentData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe(PaymentStatus.PROCESSING);

      const failedPaymentId = response.body.id;

      // Wait for the websocket event
      return new Promise<void>((resolve, reject) => {
        const handler = (data) => {
          if (
            data.paymentId === failedPaymentId &&
            data.status === PaymentStatus.FAILED
          ) {
            expect(data.type).toBe('PAYMENT_UPDATE');
            expect(data.errorReason).toBe('card_expired');
            socket.off('payment_update', handler);
            resolve();
          }
        };

        socket.on('payment_update', handler);

        setTimeout(() => {
          socket.off('payment_update', handler);
          reject(
            new Error(
              'Timed out waiting for expired card failure notification',
            ),
          );
        }, paymentProcessingDelay + 1000);
      });
    });
  });

  describe('Refund Processing', () => {
    it('should create a refund for a successful payment', async () => {
      const refundData = {
        paymentId: testPaymentId,
        amount: 100,
      };

      const response = await request(app.getHttpServer())
        .post('/payments/refund')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(refundData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe(RefundStatus.PROCESSING);

      testRefundId = response.body.id;
    });

    it('should be able to cancel a refund and receive cancellation notification', async () => {
      const cancelData = {
        refundId: testRefundId,
      };

      // Create a promise that will resolve when the websocket event is received
      const notificationPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.off('refund_update', handler);
          reject(
            new Error('Timed out waiting for refund cancellation notification'),
          );
        }, refundProcessingDelay + 1000);
        const handler = (data) => {
          if (
            data.refundId === testRefundId &&
            data.status === RefundStatus.CANCELLED
          ) {
            expect(data.type).toBe('REFUND_UPDATE');
            expect(data.paymentId).toBe(testPaymentId);
            socket.off('refund_update', handler);
            clearTimeout(timeout);
            resolve();
          }
        };

        socket.on('refund_update', handler);
      });

      // Now make the HTTP request
      const response = await request(app.getHttpServer())
        .post('/payments/refund/cancel')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(cancelData)
        .expect(201);

      expect(response.body.id).toBe(testRefundId);
      expect(response.body.status).toBe(RefundStatus.CANCELLED);

      // Wait for the websocket event
      return notificationPromise;
    });

    it('should create another refund that completes successfully and receive success notification', async () => {
      const refundData = {
        paymentId: testPaymentId,
        amount: 50,
      };

      const response = await request(app.getHttpServer())
        .post('/payments/refund')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(refundData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe(RefundStatus.PROCESSING);

      const newRefundId = response.body.id;

      // Wait for the websocket event
      return new Promise<void>((resolve, reject) => {
        const handler = (data) => {
          if (
            data.refundId === newRefundId &&
            data.status === RefundStatus.SUCCESSFUL
          ) {
            expect(data.type).toBe('REFUND_UPDATE');
            socket.off('refund_update', handler);
            resolve();
          }
        };

        socket.on('refund_update', handler);

        setTimeout(() => {
          socket.off('refund_update', handler);
          reject(
            new Error('Timed out waiting for successful refund notification'),
          );
        }, refundProcessingDelay + 1000);
      });
    }); // Adjust the test timeout to accommodate the configured delay
  });

  describe('Error Handling', () => {
    it('should reject requests with invalid JWT token', async () => {
      const paymentData = {
        amount: 100,
        cardNumber: '1111 1111 1111 1111',
        cardholderName: 'Test User',
        expiryDate: '12/25',
        cvv: '123',
      };

      await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', 'Bearer invalid-token')
        .send(paymentData)
        .expect(401);
    });

    it('should reject requests with no JWT token', async () => {
      const paymentData = {
        amount: 100,
        cardNumber: '1111 1111 1111 1111',
        cardholderName: 'Test User',
        expiryDate: '12/25',
        cvv: '123',
      };

      await request(app.getHttpServer())
        .post('/payments')
        .send(paymentData)
        .expect(401);
    });

    it('should reject refund for non-existent payment', async () => {
      const refundData = {
        paymentId: '00000000-0000-0000-0000-000000000000',
      };

      await request(app.getHttpServer())
        .post('/payments/refund')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(refundData)
        .expect(404);
    });

    it('should reject refund cancellation for non-existent refund', async () => {
      const cancelData = {
        refundId: '00000000-0000-0000-0000-000000000000',
      };

      await request(app.getHttpServer())
        .post('/payments/refund/cancel')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(cancelData)
        .expect(404);
    });
  });

  describe('WebSocket Disconnection', () => {
    it('should disconnect from WebSocket', (done) => {
      socket.on('disconnect', () => {
        expect(socket.connected).toBe(false);
        done();
      });

      socket.disconnect();
    });
  });
});
