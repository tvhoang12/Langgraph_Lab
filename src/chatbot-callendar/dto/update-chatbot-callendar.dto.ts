import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateChatbotCallendarDto {
  @ApiProperty({
    description: 'Tin nhắn tiếp theo gửi đến bot',
    example: 'Vậy ngày mai thì sao?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'ID người dùng',
    example: 'user-001',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Năm sinh âm lịch (nếu cần tính toán ngày tốt cá nhân)',
    example: 1995,
  })
  @IsOptional()
  lunarBirthYear?: number;

  @ApiPropertyOptional({
    description: 'Công việc cụ thể (Khởi công, Về nhà mới, Cưới hỏi, v.v.)',
    example: 'Về nhà mới',
  })
  @IsString()
  @IsOptional()
  activity?: string;
}
