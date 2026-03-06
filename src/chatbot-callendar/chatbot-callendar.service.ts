import { Injectable, Logger } from '@nestjs/common';
import { CreateChatbotCallendarDto } from './dto/create-chatbot-callendar.dto';
import { UpdateChatbotCallendarDto } from './dto/update-chatbot-callendar.dto';
import { AiAgentService } from './ai-agent.service';
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

  constructor(private aiAgentService: AiAgentService) {}

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
    const { userId, message, lunarBirthYear, activity } = updateChatbotCallendarDto;

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

      const assistantMessage = this.extractAgentResponse(response);

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
          state: response.state,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Error updating chatbot message: ${error.message}`);
      // this.logger.debug(`Failed to update session: ${sessionId}`);
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

}
