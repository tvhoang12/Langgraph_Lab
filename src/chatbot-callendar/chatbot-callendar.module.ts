import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ChatbotCallendarService } from './chatbot-callendar.service';
import { ChatbotCallendarController } from './chatbot-callendar.controller';
import { AiAgentService } from './ai-agent.service';
import { ApprovalService } from './approval.service';
import { ApprovalController } from './approval.controller';
import { PendingApprovalEntity } from './entities/pending-approval-db.entity';

@Module({
  imports: [MikroOrmModule.forFeature([PendingApprovalEntity])],
  controllers: [ChatbotCallendarController, ApprovalController],
  providers: [ChatbotCallendarService, AiAgentService, ApprovalService],
  exports: [ChatbotCallendarService, ApprovalService],
})
export class ChatbotCallendarModule {}
