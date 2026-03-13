import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApprovalService } from './approval.service';
import { SubmitApprovalDto, GetPendingApprovalsDto } from './dto/approval.dto';

@ApiTags('Human Approval')
@Controller('approval')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  /**
   * Lấy danh sách pending approvals
   */
  @Get('pending')
  @ApiOperation({
    summary: 'Lấy danh sách pending approvals',
    description: 'Lấy danh sách các quyết định của AI đang chờ con người xác nhận',
  })
  @ApiQuery({
    name: 'sessionId',
    required: false,
    description: 'Filter by session ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'MODIFIED'],
    description: 'Filter by approval status',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách pending approvals',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'approval-uuid',
            sessionId: 'session-uuid',
            userId: 'user-001',
            status: 'PENDING',
            toolName: 'xem_ngay_tot_viec_tot_am_lich_vn',
            toolInput: { lunarBirthYear: 1990, activity: 'khai-truong' },
            toolOutput: { goodDays: ['2026-03-10', '2026-03-15'] },
            conversationContext: {
              userMessage: 'Ngày nào tốt để khai trương?',
              aiDecision: 'Gọi tool xem ngày tốt theo tuổi và việc',
            },
            createdAt: '2026-03-09T10:00:00Z',
          },
        ],
      },
    },
  })
  async getPendingApprovals(
    @Query('sessionId') sessionId?: string,
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED',
  ) {
    const approvals = await this.approvalService.getPendingApprovals(
      sessionId,
      status,
    );
    return {
      success: true,
      data: approvals,
    };
  }

  /**
   * Lấy chi tiết pending approval
   */
  @Get(':approvalId')
  @ApiOperation({
    summary: 'Lấy chi tiết pending approval',
    description: 'Xem chi tiết quyết định của AI cần xác nhận',
  })
  @ApiParam({
    name: 'approvalId',
    description: 'Approval ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết approval',
  })
  async getPendingApprovalById(@Param('approvalId') approvalId: string) {
    const approval = await this.approvalService.getPendingApprovalById(
      approvalId,
    );
    return {
      success: true,
      data: approval,
    };
  }

  /**
   * CÁCH 2: Submit approval action + trực tiếp trả AI response
   */
  @Post('submit')
  @ApiOperation({
    summary: 'Approve/Reject/Modify + lấy AI response (Cách 2)',
    description:
      'Submit approval action và nhận AI response trực tiếp (nếu APPROVE/MODIFY). Optional: pass sessionId + lunarBirthYear + activity để lấy response',
  })
  @ApiResponse({
    status: 200,
    description: 'Action submitted + AI response trả về',
    schema: {
      example: {
        success: true,
        data: {
          approval: {
            id: 'approval-uuid',
            status: 'APPROVED',
            toolName: 'xem_ngay_tot_viec_tot_am_lich_vn',
          },
          aiResponse: 'Dựa trên kết quả, những ngày tốt để khởi công là 15/3, 16/3, 20/3...',
        },
      },
    },
  })
  async submitApprovalAction(
    @Body()
    submitApprovalDto: SubmitApprovalDto & {
      sessionId?: string;
      lunarBirthYear?: number;
      activity?: string;
    },
  ) {
    // Nếu có sessionId, sử dụng Cách 2 (trả AI response trực tiếp)
    if (submitApprovalDto.sessionId) {
      const result = await this.approvalService.submitApprovalActionAndGetResponse(
        submitApprovalDto.approvalId,
        {
          action: submitApprovalDto.action,
          notes: submitApprovalDto.notes,
          modifiedData: submitApprovalDto.modifiedData,
          approvedBy: submitApprovalDto.userId,
        },
        submitApprovalDto.sessionId,
        submitApprovalDto.lunarBirthYear,
        submitApprovalDto.activity,
      );

      return {
        success: true,
        data: result,
      };
    }

    // Ngược lại, sử dụng cách cũ (chỉ trả approval status)
    const approval = await this.approvalService.submitApprovalAction(
      submitApprovalDto.approvalId,
      {
        action: submitApprovalDto.action,
        notes: submitApprovalDto.notes,
        modifiedData: submitApprovalDto.modifiedData,
        approvedBy: submitApprovalDto.userId,
      },
    );

    return {
      success: true,
      data: {
        approval,
        message: 'Use optional sessionId param to get AI response directly',
      },
    };
  }

  /**
   * Lấy final output sau khi human approve
   */
  @Get(':approvalId/output')
  @ApiOperation({
    summary: 'Lấy final output sau approval',
    description: 'Lấy dữ liệu cuối cùng (đã được người dùng approve/modify)',
  })
  @ApiParam({
    name: 'approvalId',
  })
  @ApiResponse({
    status: 200,
    description: 'Final output từ tool',
  })
  async getFinalApprovalOutput(@Param('approvalId') approvalId: string) {
    const output = await this.approvalService.getFinalApprovalOutput(
      approvalId,
    );

    return {
      success: true,
      data: output,
    };
  }

  /**
   * Lấy pending approvals của một session
   */
  @Get('session/:sessionId')
  @ApiOperation({
    summary: 'Lấy pending approvals của session',
  })
  @ApiParam({
    name: 'sessionId',
  })
  async getSessionPendingApprovals(@Param('sessionId') sessionId: string) {
    const approvals = await this.approvalService.getSessionPendingApprovals(
      sessionId,
    );

    return {
      success: true,
      data: {
        sessionId,
        pendingCount: approvals.length,
        approvals,
      },
    };
  }
}
