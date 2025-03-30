import { registerAs } from '@nestjs/config';

export default registerAs('payments', () => ({
  processingDelays: {
    payment: parseInt(process.env.PAYMENT_PROCESSING_DELAY_MS ?? '15000', 10),
    refund: parseInt(process.env.REFUND_PROCESSING_DELAY_MS ?? '30000', 10),
  },
}));
