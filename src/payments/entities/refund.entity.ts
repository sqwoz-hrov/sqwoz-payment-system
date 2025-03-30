import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Payment } from './payment.entity';

export enum RefundStatus {
  PROCESSING = 'processing',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity()
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  amount: number;

  @Column({
    type: 'simple-enum',
    enum: RefundStatus,
    default: RefundStatus.PROCESSING,
  })
  status: RefundStatus;

  @ManyToOne(() => Payment, (payment) => payment.refunds)
  payment: Payment;

  @Column()
  paymentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
