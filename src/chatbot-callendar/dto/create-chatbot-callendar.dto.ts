import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateChatbotCallendarDto {
  @ApiProperty({
    description: 'Tin nhắn gửi đến bot',
    example: 'Hôm nay ngày tốt không?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'ID người dùng',
    example: 'user-001',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: 'Năm sinh âm lịch (nếu có)',
    example: 1995,
  })
  @IsOptional()
  lunarBirthYear?: number;

  @ApiPropertyOptional({
    description: 'Công việc cần xem (nếu có)',
    example: 'Khởi công',
  })
  @IsString()
  @IsOptional()
  activity?: string;
}
