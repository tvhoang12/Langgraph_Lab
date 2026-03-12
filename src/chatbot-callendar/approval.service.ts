import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { PendingApprovalEntity, ApprovalStatus } from './entities/pending-approval-db.entity';
import { PendingApproval, ApprovalAction } from './entities/pending-approval.entity';

@Injectable()
export class ApprovalService {
  private logger = new Logger(ApprovalService.name);

  constructor(private em: EntityManager) {}

  /**
   * Tạo pending approval khi AI quyết định gọi tool
   */
  async createPendingApproval(
    sessionId: string,
    userId: string,
    toolName: string,
    toolInput: Record<string, any>,
    toolOutput: Record<string, any>,
    context?: {
      userMessage: string;
      aiDecision: string;
    },
  ): Promise<PendingApproval> {
    const id = uuidv4();

    const entity = new PendingApprovalEntity({
      id,
      sessionId,
      userId,
      toolName,
      toolInput,
      toolOutput,
      conversationContext: context,
      status: ApprovalStatus.PENDING,
      createdAt: new Date(),
    });

    await this.em.persistAndFlush(entity);

    this.logger.log(
      `Created pending approval ${id} for session ${sessionId}, tool: ${toolName}`,
    );

    return this.mapEntityToInterface(entity);
  }

  /**
   * Lấy danh sách pending approvals
   */
  async getPendingApprovals(
    sessionId?: string,
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED',
  ): Promise<PendingApproval[]> {
    const where: any = {};

    if (sessionId) {
      where.sessionId = sessionId;
    }
    if (status) {
      where.status = status;
    }

    const entities = await this.em.find(PendingApprovalEntity, where);
    return entities.map((e) => this.mapEntityToInterface(e));
  }

  /**
   * Lấy chi tiết pending approval
   */
  async getPendingApprovalById(approvalId: string): Promise<PendingApproval> {
    const entity = await this.em.findOne(PendingApprovalEntity, { id: approvalId });

    if (!entity) {
      throw new BadRequestException(`Approval ${approvalId} not found`);
    }

    return this.mapEntityToInterface(entity);
  }

  /**
   * Submit action cho pending approval (approve/reject/modify)
   */
  async submitApprovalAction(
    approvalId: string,
    action: ApprovalAction,
  ): Promise<PendingApproval> {
    const entity = await this.em.findOne(PendingApprovalEntity, { id: approvalId });

    if (!entity) {
      throw new BadRequestException(`Approval ${approvalId} not found`);
    }

    if (entity.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Cannot submit action on approval with status: ${entity.status}`,
      );
    }

    // Cập nhật approval dựa trên action
    switch (action.action) {
      case 'APPROVE':
        entity.status = ApprovalStatus.APPROVED;
        entity.approvedAt = new Date();
        entity.approvedBy = action.approvedBy;
        if (action.notes) {
          entity.userNotes = action.notes;
        }
        this.logger.log(`Approval ${approvalId} approved by ${action.approvedBy}`);
        break;

      case 'REJECT':
        entity.status = ApprovalStatus.REJECTED;
        entity.approvedAt = new Date();
        entity.approvedBy = action.approvedBy;
        if (action.notes) {
          entity.userNotes = action.notes;
        }
        this.logger.log(`Approval ${approvalId} rejected by ${action.approvedBy}`);
        break;

      case 'MODIFY':
        if (!action.modifiedData) {
          throw new BadRequestException(
            'modifiedData is required for MODIFY action',
          );
        }
        entity.status = ApprovalStatus.MODIFIED;
        entity.modifiedOutput = action.modifiedData;
        entity.approvedAt = new Date();
        entity.approvedBy = action.approvedBy;
        if (action.notes) {
          entity.userNotes = action.notes;
        }
        this.logger.log(
          `Approval ${approvalId} modified by ${action.approvedBy}`,
        );
        break;
    }

    await this.em.persistAndFlush(entity);
    return this.mapEntityToInterface(entity);
  }

  /**
   * Lấy final output sau khi human approve/modify
   */
  async getFinalApprovalOutput(approvalId: string): Promise<Record<string, any>> {
    const entity = await this.em.findOne(PendingApprovalEntity, { id: approvalId });

    if (!entity) {
      throw new BadRequestException(`Approval ${approvalId} not found`);
    }

    if (entity.status === ApprovalStatus.PENDING) {
      throw new BadRequestException(`Approval ${approvalId} is still pending`);
    }

    if (entity.status === ApprovalStatus.REJECTED) {
      throw new BadRequestException(`Approval ${approvalId} was rejected`);
    }

    // APPROVED: return original toolOutput
    // MODIFIED: return modifiedOutput
    return entity.status === ApprovalStatus.MODIFIED
      ? entity.modifiedOutput || entity.toolOutput || {}
      : entity.toolOutput || {};
  }

  /**
   * Lấy all pending approvals của một session
   */
  async getSessionPendingApprovals(
    sessionId: string,
  ): Promise<PendingApproval[]> {
    return this.getPendingApprovals(sessionId, 'PENDING');
  }

  /**
   * Map entity to interface
   */
  private mapEntityToInterface(entity: PendingApprovalEntity): PendingApproval {
    return {
      id: entity.id,
      sessionId: entity.sessionId,
      userId: entity.userId,
      status: entity.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED',
      toolName: entity.toolName,
      toolInput: entity.toolInput,
      toolOutput: entity.toolOutput || {},
      userNotes: entity.userNotes,
      modifiedOutput: entity.modifiedOutput,
      createdAt: entity.createdAt,
      approvedAt: entity.approvedAt,
      approvedBy: entity.approvedBy,
      conversationContext: entity.conversationContext,
    };
  }
}

