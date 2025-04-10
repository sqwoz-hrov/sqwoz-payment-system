import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Merchant } from '../src/merchants/entities/merchant.entity';
import { PaymentStatus } from '../src/payments/entities/payment.entity';
import { RefundStatus } from '../src/payments/entities/refund.entity';
import { ConfigService } from '@nestjs/config';
import * as WebSocket from 'ws';

describe('PaymentSystem (e2e)', () => {
  let app: INestApplication;
  let merchantsRepository: Repository<Merchant>;
  let dataSource: DataSource;
  let configService: ConfigService;

  let testMerchant: Merchant;
  let testPaymentId: string;
  let testRefundId: string;
  let jwtToken: string;

  let paymentProcessingDelay: number;
  let refundProcessingDelay: number;

  const createWebSocket = () => {
    // Add explicit logging
    console.log(`Creating WebSocket connection with token: ${jwtToken}`);

    // Try with the full URL including protocol
    const wsUrl = `ws://localhost:3000/payments?token=${jwtToken}`;
    console.log(`Connecting to: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);

    // Add more detailed event handlers for better debugging
    ws.on('open', () => {
      console.log('WebSocket connection opened successfully');
    });

    ws.on('error', (err) => {
      console.error('WebSocket error occurred:', err);
    });

    ws.on('close', (code, reason) => {
      console.log(
        `WebSocket closed with code: ${code}, reason: ${reason || 'No reason provided'}`,
      );
    });

    return ws;
  };

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

    paymentProcessingDelay = configService.get<number>(
      'payments.processingDelays.payment',
    )!;
    refundProcessingDelay = configService.get<number>(
      'payments.processingDelays.refund',
    )!;

    testMerchant = merchantsRepository.create({
      name: 'Test Merchant',
      key: 'test-secret-key',
    });
    await merchantsRepository.save(testMerchant);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        merchantId: testMerchant.id,
        merchantKey: testMerchant.key,
      });
    jwtToken = response.body.access_token;
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

      jwtToken = response.body.access_token;
    });
  });

  describe('WebSocket Connection', () => {
    let ws: WebSocket;

    afterEach((done) => {
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.on('close', () => done());
        ws.close();
      } else {
        done();
      }
    });

    it('should connect to WebSocket with JWT token', (done) => {
      ws = createWebSocket();

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        done();
      });

      ws.on('error', (err) => {
        done(`Failed to connect: ${err.message}`);
      });
    });

    it('should receive connection established event', (done) => {
      ws = createWebSocket();

      ws.on('open', () => {
        const handler = (message) => {
          const data = JSON.parse(message.toString());
          if (data.event === 'connection_established') {
            expect(data.data.merchantId).toBe(testMerchant.id);
            expect(data.data.message).toBe('Connected to payment system');
            ws.removeListener('message', handler);
            done();
          }
        };

        ws.on('message', handler);
      });
    });
  });

  describe('Payment Processing', () => {
    let ws: WebSocket;

    beforeEach((done) => {
      ws = createWebSocket();

      // Add a timeout to prevent test hanging if connection fails
      const connectionTimeout = setTimeout(() => {
        done('WebSocket connection timed out');
      }, 5000);

      ws.on('open', () => {
        clearTimeout(connectionTimeout);
        // Give the server a moment to finish setup
        setTimeout(done, 100);
      });

      ws.on('error', (err) => {
        clearTimeout(connectionTimeout);
        done(`WebSocket connection failed: ${err.message}`);
      });
    });

    afterEach((done) => {
      // Add a timeout to prevent test hanging if close event never fires
      const closeTimeout = setTimeout(() => {
        // Force the test to continue even if close event doesn't fire
        console.warn('WebSocket close event timed out, forcing cleanup');
        done();
      }, 3000);

      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.on('close', () => {
          clearTimeout(closeTimeout);
          done();
        });

        try {
          ws.close();
        } catch (err) {
          clearTimeout(closeTimeout);
          console.warn('Error during WebSocket close:', err);
          done();
        }
      } else {
        clearTimeout(closeTimeout);
        done();
      }
    });

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

      return new Promise<void>((resolve, reject) => {
        const handler = (message) => {
          const data = JSON.parse(message.toString());
          if (
            data.event === 'payment_update' &&
            data.data.paymentId === testPaymentId &&
            data.data.status === PaymentStatus.SUCCESSFUL
          ) {
            expect(data.data.type).toBe('PAYMENT_UPDATE');
            expect(data.data.errorReason).toBe('none');
            ws.removeListener('message', handler);
            resolve();
          }
        };

        ws.on('message', handler);

        setTimeout(() => {
          ws.removeListener('message', handler);
          reject(
            new Error('Timed out waiting for successful payment notification'),
          );
        }, paymentProcessingDelay + 1000);
      });
    });

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

      return new Promise<void>((resolve, reject) => {
        const handler = (message) => {
          const data = JSON.parse(message.toString());
          if (
            data.event === 'payment_update' &&
            data.data.paymentId === failedPaymentId &&
            data.data.status === PaymentStatus.FAILED
          ) {
            expect(data.data.type).toBe('PAYMENT_UPDATE');
            expect(data.data.errorReason).toBe('insufficient_balance');
            ws.removeListener('message', handler);
            resolve();
          }
        };

        ws.on('message', handler);

        setTimeout(() => {
          ws.removeListener('message', handler);
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

      return new Promise<void>((resolve, reject) => {
        const handler = (message) => {
          const data = JSON.parse(message.toString());
          if (
            data.event === 'payment_update' &&
            data.data.paymentId === failedPaymentId &&
            data.data.status === PaymentStatus.FAILED
          ) {
            expect(data.data.type).toBe('PAYMENT_UPDATE');
            expect(data.data.errorReason).toBe('incorrect_card_details');
            ws.removeListener('message', handler);
            resolve();
          }
        };

        ws.on('message', handler);

        setTimeout(() => {
          ws.removeListener('message', handler);
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

      return new Promise<void>((resolve, reject) => {
        const handler = (message) => {
          const data = JSON.parse(message.toString());
          if (
            data.event === 'payment_update' &&
            data.data.paymentId === failedPaymentId &&
            data.data.status === PaymentStatus.FAILED
          ) {
            expect(data.data.type).toBe('PAYMENT_UPDATE');
            expect(data.data.errorReason).toBe('card_expired');
            ws.removeListener('message', handler);
            resolve();
          }
        };

        ws.on('message', handler);

        setTimeout(() => {
          ws.removeListener('message', handler);
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
    let ws: WebSocket;

    beforeEach((done) => {
      ws = createWebSocket();
      ws.on('open', () => done());
      ws.on('error', (err) =>
        done(`WebSocket connection failed: ${err.message}`),
      );
    });

    afterEach((done) => {
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.on('close', () => done());
        ws.close();
      } else {
        done();
      }
    });

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

      const notificationPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.removeListener('message', handler);
          reject(
            new Error('Timed out waiting for refund cancellation notification'),
          );
        }, refundProcessingDelay + 1000);

        const handler = (message) => {
          const data = JSON.parse(message.toString());
          if (
            data.event === 'refund_update' &&
            data.data.refundId === testRefundId &&
            data.data.status === RefundStatus.CANCELLED
          ) {
            expect(data.data.type).toBe('REFUND_UPDATE');
            expect(data.data.paymentId).toBe(testPaymentId);
            ws.removeListener('message', handler);
            clearTimeout(timeout);
            resolve();
          }
        };

        ws.on('message', handler);
      });

      const response = await request(app.getHttpServer())
        .post('/payments/refund/cancel')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(cancelData)
        .expect(201);

      expect(response.body.id).toBe(testRefundId);
      expect(response.body.status).toBe(RefundStatus.CANCELLED);

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

      return new Promise<void>((resolve, reject) => {
        const handler = (message) => {
          const data = JSON.parse(message.toString());
          if (
            data.event === 'refund_update' &&
            data.data.refundId === newRefundId &&
            data.data.status === RefundStatus.SUCCESSFUL
          ) {
            expect(data.data.type).toBe('REFUND_UPDATE');
            ws.removeListener('message', handler);
            resolve();
          }
        };

        ws.on('message', handler);

        setTimeout(() => {
          ws.removeListener('message', handler);
          reject(
            new Error('Timed out waiting for successful refund notification'),
          );
        }, refundProcessingDelay + 1000);
      });
    });
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
        .expect(400);
    });

    it('should reject refund cancellation for non-existent refund', async () => {
      const cancelData = {
        refundId: '00000000-0000-0000-0000-000000000000',
      };

      await request(app.getHttpServer())
        .post('/payments/refund/cancel')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(cancelData)
        .expect(400);
    });
  });

  describe('WebSocket Disconnection', () => {
    let ws: WebSocket;

    beforeEach(() => {
      ws = createWebSocket();
    });

    it('should disconnect from WebSocket', (done) => {
      ws.on('open', () => {
        ws.on('close', () => {
          expect(ws.readyState).toBe(WebSocket.CLOSED);
          done();
        });

        ws.close();
      });
    });
  });
});
