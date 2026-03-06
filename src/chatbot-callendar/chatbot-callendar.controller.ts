import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ChatbotCallendarService } from './chatbot-callendar.service';
import { CreateChatbotCallendarDto } from './dto/create-chatbot-callendar.dto';
import { UpdateChatbotCallendarDto } from './dto/update-chatbot-callendar.dto';

@ApiTags('Chatbot Calendar')
@Controller('chatbot-calendar')
export class ChatbotCallendarController {
  constructor(
    private readonly chatbotCallendarService: ChatbotCallendarService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Tạo cuộc trò chuyện mới',
    description:
      'Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện mới với bot. Bot sẽ trả về sessionId để tiếp tục trò chuyện.',
  })
  @ApiBody({ type: CreateChatbotCallendarDto })
  @ApiResponse({
    status: 201,
    description: 'Cuộc trò chuyện được tạo thành công',
    schema: {
      example: {
        success: true,
        data: {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'user-001',
          message: 'Hôm nay ngày tốt không?',
          response: 'Hôm nay là ngày...',
          timestamp: '2026-03-05T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async create(@Body() createChatbotCallendarDto: CreateChatbotCallendarDto) {
    return await this.chatbotCallendarService.create(
      createChatbotCallendarDto,
    );
  }

  @Get(':sessionId')
  @ApiOperation({
    summary: 'Lấy lịch sử cuộc trò chuyện',
    description: 'Lấy toàn bộ lịch sử tin nhắn của cuộc trò chuyện theo sessionId',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID của cuộc trò chuyện',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy lịch sử thành công',
    schema: {
      example: {
        success: true,
        data: {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          history: [
            {
              role: 'user',
              content: 'Hôm nay ngày tốt không?',
              timestamp: '2026-03-05T10:00:00.000Z',
            },
            {
              role: 'assistant',
              content: 'Hôm nay là ngày...',
              timestamp: '2026-03-05T10:00:01.000Z',
            },
          ],
        },
      },
    },
  })
  async findOne(@Param('sessionId') sessionId: string) {
    return await this.chatbotCallendarService.findOne(sessionId);
  }

  @Patch(':sessionId')
  @ApiOperation({
    summary: 'Gửi tin nhắn tiếp theo',
    description:
      'Gửi tin nhắn tiếp theo trong cuộc trò chuyện đã có. Bot sẽ nhớ context từ các tin nhắn trước.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID của cuộc trò chuyện',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({ type: UpdateChatbotCallendarDto })
  @ApiResponse({
    status: 200,
    description: 'Tin nhắn được gửi thành công',
    schema: {
      example: {
        success: true,
        data: {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'user-001',
          message: 'Vậy ngày mai thì sao?',
          response: 'Ngày mai là...',
          timestamp: '2026-03-05T10:01:00.000Z',
        },
      },
    },
  })
  async update(
    @Param('sessionId') sessionId: string,
    @Body() updateChatbotCallendarDto: UpdateChatbotCallendarDto,
  ) {
    return await this.chatbotCallendarService.update(
      sessionId,
      updateChatbotCallendarDto,
    );
  }

  @Delete(':sessionId')
  @ApiOperation({
    summary: 'Xóa cuộc trò chuyện',
    description: 'Xóa toàn bộ lịch sử và memory của cuộc trò chuyện',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID của cuộc trò chuyện',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Cuộc trò chuyện được xóa thành công',
    schema: {
      example: {
        success: true,
        message: 'Session 550e8400-e29b-41d4-a716-446655440000 cleared successfully',
      },
    },
  })
  async remove(@Param('sessionId') sessionId: string) {
    return await this.chatbotCallendarService.remove(sessionId);
  }
}
