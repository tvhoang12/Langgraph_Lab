import { Module } from '@nestjs/common';
import { ChatbotCallendarService } from './chatbot-callendar.service';
import { ChatbotCallendarController } from './chatbot-callendar.controller';
import { AiAgentService } from './ai-agent.service';

@Module({
  controllers: [ChatbotCallendarController],
  providers: [ChatbotCallendarService, AiAgentService],
  exports: [ChatbotCallendarService],
})
export class ChatbotCallendarModule {}
