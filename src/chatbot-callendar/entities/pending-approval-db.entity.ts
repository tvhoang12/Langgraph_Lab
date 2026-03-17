import { Entity, PrimaryKey, Property, Enum } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  MODIFIED = 'MODIFIED',
}

@Entity({
  tableName: 'pending_approvals',
})
export class PendingApprovalEntity {
  @PrimaryKey()
  id: string = uuidv4();

  @Property()
  sessionId!: string;

  @Property()
  userId!: string;

  @Enum(() => ApprovalStatus)
  status: ApprovalStatus = ApprovalStatus.PENDING;

  @Property()
  toolName!: string;

  @Property({ type: 'jsonb' })
  toolInput!: Record<string, any>;

  @Property({ type: 'jsonb', nullable: true })
  toolOutput?: Record<string, any>;

  @Property({ nullable: true })
  userNotes?: string;

  @Property({ type: 'jsonb', nullable: true })
  modifiedOutput?: Record<string, any>;

  @Property({ type: 'jsonb', nullable: true })
  coachingFeedback?: {
    errorType?: 'HALLUCINATION' | 'POLICY' | 'FORMAT' | 'DOMAIN' | 'OTHER';
    reason: string;
    correction?: string;
    tags?: string[];
    confidence?: number;
    coachedBy: string;
    coachedAt: Date;
  };

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Property({ nullable: true })
  approvedBy?: string;

  @Property({ type: 'jsonb', nullable: true })
  conversationContext?: {
    userMessage: string;
    aiDecision: string;
  };

  constructor(data: Partial<PendingApprovalEntity> = {}) {
    Object.assign(this, data);
  }
}