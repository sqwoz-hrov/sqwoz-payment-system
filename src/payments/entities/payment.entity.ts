import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { Refund } from './refund.entity';

export enum PaymentStatus {
  PROCESSING = 'processing',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
}

export enum PaymentErrorReason {
  NONE = 'none',
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  INCORRECT_CARD_DETAILS = 'incorrect_card_details',
  CARD_EXPIRED = 'card_expired',
}

@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  amount: number;

  @Column()
  cardNumber: string;

  @Column()
  cardholderName: string;

  @Column()
  expiryDate: string;

  @Column()
  cvv: string;

  @Column({
    type: 'simple-enum',
    enum: PaymentStatus,
    default: PaymentStatus.PROCESSING,
  })
  status: PaymentStatus;

  @Column({
    type: 'simple-enum',
    enum: PaymentErrorReason,
    default: PaymentErrorReason.NONE,
  })
  errorReason: PaymentErrorReason;

  @ManyToOne(() => Merchant, (merchant) => merchant.payments)
  merchant: Merchant;

  @Column()
  merchantId: string;

  @OneToMany(() => Refund, (refund) => refund.payment)
  refunds: Refund[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
