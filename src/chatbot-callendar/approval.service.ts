import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { PendingApprovalEntity, ApprovalStatus } from './entities/pending-approval-db.entity';
import { PendingApproval, ApprovalAction } from './entities/pending-approval.types';
import { AiAgentService } from './ai-agent.service';

@Injectable()
export class ApprovalService {
  private logger = new Logger(ApprovalService.name);

  constructor(
    private em: EntityManager,
    private aiAgentService: AiAgentService,
  ) {}

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

    // Lưu coaching feedback nếu được cung cấp
    if (action.coaching) {
      entity.coachingFeedback = {
        ...action.coaching,
        coachedBy: action.coaching.coachedBy || action.approvedBy,
        coachedAt: new Date(),
      };
      this.logger.log(
        `Coaching feedback set for approval ${approvalId}: ${action.coaching.reason}`,
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

    // MODIFIED: return modifiedOutput if exists, otherwise toolOutput
    // APPROVED: return toolOutput
    const output = entity.status === ApprovalStatus.MODIFIED
      ? entity.modifiedOutput || entity.toolOutput
      : entity.toolOutput;

    if (!output) {
      throw new BadRequestException(
        `No output available for approval ${approvalId}. Tool may not have executed successfully.`,
      );
    }

    return output;
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
   * CÁCH 2: Submit approval action và trực tiếp trả AI response
   * Sau khi APPROVE/MODIFY, execute tool và invoke agent để lấy response
   */
  async submitApprovalActionAndGetResponse(
    approvalId: string,
    action: ApprovalAction,
    sessionId: string,
    lunarBirthYear?: number,
    activity?: string,
  ): Promise<{ approval: PendingApproval; aiResponse?: string; message?: string }> {
    // Trước tiên, submit approval action
    const approval = await this.submitApprovalAction(approvalId, action);

    this.logger.log(
      `Approval ${approvalId} submitted with action: ${action.action}`,
    );

    // Nếu REJECTED, không invoke agent
    if (approval.status === 'REJECTED') {
      return {
        approval,
        message: `Tool execution "${approval.toolName}" was rejected${
          action.notes ? ': ' + action.notes : ''
        }`,
      };
    }

    // Nếu APPROVED hoặc MODIFIED, execute tool và invoke agent để lấy AI response
    try {
      // Execute tool với input parameters
      const toolOutput = await this.executeTool(
        approval.toolName,
        approval.toolInput,
        approval.status === 'MODIFIED' && action.modifiedData
          ? action.modifiedData
          : undefined,
      );

      // Update approval với tool output
      const entity = await this.em.findOne(PendingApprovalEntity, { id: approvalId });
      if (entity) {
        entity.toolOutput = toolOutput;
        await this.em.persistAndFlush(entity);
      }

      const coachingHint = this.buildCoachingHint(
        approval.coachingFeedback ?? action.coaching,
      );

      this.logger.log(
        `Tool "${approval.toolName}" executed successfully: ${JSON.stringify(toolOutput).substring(0, 100)}`,
      );

      // Invoke agent để lấy AI response
      const agentInput = [
        coachingHint,
        `Tool "${approval.toolName}" executed successfully with result: ${JSON.stringify(toolOutput)}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      this.logger.debug('Invoking AI agent with input: ' + agentInput);

      const agentResponse = await this.aiAgentService.invokeAgent(
        agentInput,
        sessionId,
        lunarBirthYear,
        activity,
      );

      const aiResponse = this.extractAgentResponse(agentResponse);

      const latest = await this.em.findOneOrFail(PendingApprovalEntity, { id: approvalId });

      this.logger.log(
        `Got AI response for approval ${approvalId}: ${aiResponse.substring(0, 100)}...`,
      );

      return {
        approval: this.mapEntityToInterface(latest),
        aiResponse,
      };
    } catch (error) {
      this.logger.error(
        `Error getting AI response for approval ${approvalId}: ${error.message}`,
      );
      this.logger.debug('Error details: ' + JSON.stringify(error));
      return {
        approval,
        message: `Approval submitted but failed to execute tool: ${error.message}`,
      };
    }
  }

  private buildCoachingHint(
    coaching?: ApprovalAction['coaching'],
  ): string {
    if (!coaching?.reason) return '';

    return [
      'Human coaching guidance (must follow):',
      `- errorType: ${coaching.errorType || 'OTHER'}`,
      `- reason: ${coaching.reason}`,
      `- correction: ${coaching.correction || 'N/A'}`,
      `- tags: ${(coaching.tags || []).join(', ') || 'N/A'}`,
      '- Avoid repeating the same mistake and prioritize correction.',
    ].join('\n');
  }

  private async executeTool(
    toolName: string,
    toolInput: Record<string, any>,
    modifiedData?: Record<string, any>,
  ): Promise<Record<string, any>> {
    try {
      const tools = this.aiAgentService.getAgentTools();
      const tool = tools.find((t) => t.name === toolName);

      if (!tool) {
        throw new Error(`Tool "${toolName}" not found`);
      }

      // Use modified data if provided, otherwise use original input
      const finalInput = modifiedData || toolInput;

      // Execute the tool
      const toolOutput = await tool.invoke(finalInput);

      return typeof toolOutput === 'string'
        ? { result: toolOutput }
        : toolOutput;
    } catch (error) {
      this.logger.error(
        `Error executing tool "${toolName}": ${error.message}`,
      );
      throw error;
    }
  }

  private extractAgentResponse(response: any): string {
    if (typeof response === 'string') {
      return response;
    }

    if (response.messages && response.messages.length > 0) {
      const lastMessage = response.messages[response.messages.length - 1];
      return typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);
    }

    if (response.output) {
      return response.output;
    }

    return JSON.stringify(response);
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
      coachingFeedback: entity.coachingFeedback,
    };
  }
}

