import { Injectable, Logger } from '@nestjs/common';
import { CreateChatbotCallendarDto } from './dto/create-chatbot-callendar.dto';
import { UpdateChatbotCallendarDto } from './dto/update-chatbot-callendar.dto';
import { AiAgentService } from './ai-agent.service';
import { ApprovalService } from './approval.service';
import { v4 as uuidv4 } from 'uuid';
import { BaseMessage } from '@langchain/core/messages';
import { SystemMessage } from '@langchain/core/messages';
import { AIMessage } from '@langchain/core/messages';
import { HumanMessage } from '@langchain/core/messages';

@Injectable()
export class ChatbotCallendarService {
  private logger = new Logger(ChatbotCallendarService.name);

  //state management
  private readonly HISTORY_LIMIT = 20;
  private readonly SUMMARY_THRESHOLD = 6;
  private sessionMemory: Map<string, { summary: string; memory: Record<string, any> }> = new Map();

  constructor(
    private aiAgentService: AiAgentService,
    private approvalService: ApprovalService,
  ) {}

  async create(createChatbotCallendarDto: CreateChatbotCallendarDto) {
    const { userId, message, lunarBirthYear, activity } = createChatbotCallendarDto;
    const sessionId = uuidv4();

    try {
      await this.aiAgentService.initializeMemory({
        sessionId,
        userId,
      });

      await this.aiAgentService.addUserMessage(sessionId, message);

      const response = await this.aiAgentService.invokeAgent(
        message,
        sessionId,
        lunarBirthYear,
        activity,
      );

      const assistantMessage = this.extractAgentResponse(response);

      await this.aiAgentService.addAssistantMessage(
        sessionId,
        assistantMessage,
      );

      // Lấy session state (summary & memory)
      const { summary, memory } = await this.aiAgentService.getSessionState(sessionId);

      this.logger.debug(`Session ${sessionId} created with initial message from user ${userId}`);

      return {
        success: true,
        data: {
          sessionId,
          userId,
          message,
          response: assistantMessage,
          summary,
          memory,
          state: response.state,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Error creating chatbot message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lấy lịch sử cuộc trò chuyện theo sessionId
   */
  async findOne(sessionId: string) {
    try {
      const history = await this.aiAgentService.getHistory(sessionId);
      this.logger.debug(`History retrieved for session: ${sessionId}, messages count: ${history.length}`);
      return {
        success: true,
        data: {
          sessionId,
          history,
        },
      };
    } catch (error) {
      this.logger.error(`Error finding session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gửi tin nhắn tiếp theo trong cuộc trò chuyện đã có
   */
  async update(
    sessionId: string,
    updateChatbotCallendarDto: UpdateChatbotCallendarDto,
  ) {
    const { userId = 'anonymous', message, lunarBirthYear, activity } = updateChatbotCallendarDto;

    try {
      // Add user message to history
      await this.aiAgentService.addUserMessage(sessionId, message);

      // Invoke agent với thông tin bổ sung (lunarBirthYear, activity)
      const response = await this.aiAgentService.invokeAgent(
        message,
        sessionId,
        lunarBirthYear,
        activity,
      );

      // Kiểm tra xem có tool call hay không
      const approvalStatus = await this.handlePendingApproval(
        response,
        sessionId,
        userId,
        message,
      );

      if (approvalStatus.hasPendingApproval) {
        // Có pending approval, trả về approval ID cho client
        this.logger.log(
          `Session ${sessionId} has pending approval: ${approvalStatus.approvalId}`,
        );

        return {
          success: true,
          data: {
            sessionId,
            userId,
            message,
            status: 'PENDING_APPROVAL',
            approvalId: approvalStatus.approvalId,
            message_info: 'AI đã quyết định gọi tool. Vui lòng xác nhận/chỉnh sửa trước khi tiếp tục.',
            nextStep: `GET /approval/${approvalStatus.approvalId} để xem chi tiết hoặc POST /approval/submit để phê duyệt`,
            timestamp: new Date(),
          },
        };
      }

      // Không có tool call, trả về response bình thường
      const assistantMessage = this.extractAgentResponse(approvalStatus.response);

      // Add assistant response to history
      await this.aiAgentService.addAssistantMessage(
        sessionId,
        assistantMessage,
      );

      // Lấy session state (summary & memory)
      const { summary, memory } = await this.aiAgentService.getSessionState(sessionId);

      this.logger.debug(`Session ${sessionId} updated with new message from user ${userId}`);

      return {
        success: true,
        data: {
          sessionId,
          userId,
          message,
          response: assistantMessage,
          summary,
          memory,
          state: approvalStatus.response.state,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Error updating chatbot message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Xóa cuộc trò chuyện
   */
  async remove(sessionId: string) {
    try {
      await this.aiAgentService.clearMemory(sessionId);

      this.logger.debug(`Session ${sessionId} cleared successfully`);

      return {
        success: true,
        message: `Session ${sessionId} cleared successfully`,
      };
    } catch (error) {
      this.logger.error(`Error removing session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract response từ agent
   */
  private extractAgentResponse(response: any): string {
    if (typeof response === 'string') {
      return response;
    }

    // LangGraph trả về dạng { messages: BaseMessage[] }
    if (response.messages && response.messages.length > 0) {
      const lastMessage = response.messages[response.messages.length - 1];
      return typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);
    }

    if (response.output) {
      return response.output;
    }

    this.logger.debug(`Unexpected agent response format: ${JSON.stringify(response)}`);

    return JSON.stringify(response);
  }

  private async summarizeConversation(
    messages: BaseMessage[],
    oldSummary: string,
    sessionId: string,
  ): Promise<string> {
    try {
      const llm = this.aiAgentService.getLLM();
      
      const summary_prompt = oldSummary
        ? `Đây là bản tóm tắt cũ: ${oldSummary}\n\nHãy cập nhật bản tóm tắt này bao gồm thêm cả các diễn biến mới quan trọng từ các tin nhắn sau:`
        : 'Hãy tạo một bản tóm tắt ngắn gọn và đầy đủ về cuộc hội thoại sau:';

      const messages_to_summarize = messages.slice(0, -2);
      const chat_content = messages_to_summarize
        .map((m) => {
          if (m instanceof HumanMessage) return `User: ${m.content}`;
          if (m instanceof AIMessage) return `AI: ${m.content}`;
          return '';
        })
        .filter(Boolean)
        .join('\n');

      const response = await llm.invoke([
        new SystemMessage(
          'Bạn là chuyên gia quản lý bộ nhớ. Hãy tóm tắt hội thoại bằng Tiếng Việt, giữ lại các thông tin cốt lõi (vấn đề đang hỏi, kết luận, tên người dùng, sở thích). Đừng tóm tắt quá chi tiết các câu chào hỏi.',
        ),
        new HumanMessage(`${summary_prompt}\n\n${chat_content}`),
      ]);

      return response.content as string;
    } catch (error) {
      this.logger.error(`Error summarizing conversation for session ${sessionId}: ${error.message}`);
      return oldSummary;
    }
  }

  /**
   * Lấy response từ AI sau khi human approve/modify
   */
  async getApprovalResponse(approvalId: string, sessionId: string) {
    try {
      // Lấy approval details
      const approval = await this.approvalService.getPendingApprovalById(approvalId);

      if (approval.status === 'PENDING') {
        throw new Error(
          `Approval ${approvalId} still pending. Please submit action first.`,
        );
      }

      if (approval.status === 'REJECTED') {
        return {
          success: true,
          data: {
            sessionId,
            approvalId,
            status: 'REJECTED',
            message: `Tool execution "${approval.toolName}" was rejected${
              approval.userNotes ? ': ' + approval.userNotes : ''
            }`,
            toolName: approval.toolName,
            timestamp: new Date(),
          },
        };
      }

      // Nếu APPROVED hoặc MODIFIED, get tool output và invoke agent
      let toolOutput = approval.toolOutput;

      if (approval.status === 'MODIFIED' && approval.modifiedOutput) {
        toolOutput = approval.modifiedOutput;
      }

      // Invoke agent để tiếp tục với tool result
      const { summary, memory } = await this.aiAgentService.getSessionState(sessionId);

      const agentResponse = await this.aiAgentService.invokeAgent(
        `Tool "${approval.toolName}" executed successfully with result: ${JSON.stringify(toolOutput)}`,
        sessionId,
        memory.lunarBirthYear,
        memory.activity,
      );

      const assistantMessage = this.extractAgentResponse(agentResponse);

      // Add assistant response to history
      await this.aiAgentService.addAssistantMessage(sessionId, assistantMessage);

      this.logger.log(
        `Got response for approval ${approvalId} in session ${sessionId}`,
      );

      return {
        success: true,
        data: {
          sessionId,
          approvalId,
          status: approval.status,
          toolName: approval.toolName,
          toolOutput,
          userNotes: approval.userNotes,
          aiResponse: assistantMessage,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting approval response for ${approvalId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Kiểm tra xem response có chứa tool call hay không
   */
  private extractToolCallsFromResponse(response: any): any[] {
    const toolCalls: any[] = [];

    if (response.messages && Array.isArray(response.messages)) {
      response.messages.forEach((msg: any) => {
        if (msg instanceof AIMessage && msg.tool_calls && msg.tool_calls.length > 0) {
          toolCalls.push(...msg.tool_calls);
        }
      });
    }

    return toolCalls;
  }

  /**
   * Xử lý pending approval khi AI gọi tool
   * Nếu có tool call, tạo pending approval và trả về approval ID
   * Nếu không, trả về response bình thường
   */
  private async handlePendingApproval(
    response: any,
    sessionId: string,
    userId: string,
    userMessage: string,
  ): Promise<
    | { hasPendingApproval: true; approvalId: string; response?: undefined }
    | { hasPendingApproval: false; approvalId?: undefined; response: any }
  > {
    const toolCalls = this.extractToolCallsFromResponse(response);

    if (toolCalls.length === 0) {
      // Không có tool call, trả về response bình thường
      return {
        hasPendingApproval: false,
        response,
      };
    }

    // Có tool call, tạo pending approval
    // Lưu ý: Chúng ta sẽ tạo approval cho tool call đầu tiên
    const firstToolCall = toolCalls[0];

    try {
      const pendingApproval = await this.approvalService.createPendingApproval(
        sessionId,
        userId,
        firstToolCall.name,
        firstToolCall.args || {},
        {}, // toolOutput còn trống vì chưa execute
        {
          userMessage,
          aiDecision: `Gọi tool "${firstToolCall.name}" với parameters: ${JSON.stringify(firstToolCall.args)}`,
        },
      );

      this.logger.log(
        `Created pending approval ${pendingApproval.id} for session ${sessionId}`,
      );

      return {
        hasPendingApproval: true,
        approvalId: pendingApproval.id,
      };
    } catch (error) {
      this.logger.error(
        `Error creating pending approval: ${error.message}`,
      );
      // Nếu lỗi, vẫn trả về response để không block user
      return {
        hasPendingApproval: false,
        response,
      };
    }
  }

}


