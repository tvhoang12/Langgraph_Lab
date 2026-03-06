import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatbotCallendarModule } from './chatbot-callendar/chatbot-callendar.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ChatbotCallendarModule],
})
export class AppModule {}
