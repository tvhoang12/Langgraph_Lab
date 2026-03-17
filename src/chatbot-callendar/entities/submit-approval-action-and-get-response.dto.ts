import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CoachingFeedbackDto } from '../dto/approval.dto';

export class SubmitApprovalActionAndGetResponseDto {
  @IsIn(['APPROVE', 'REJECT', 'MODIFY'])
  action!: 'APPROVE' | 'REJECT' | 'MODIFY';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  modifiedData?: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  approvedBy!: string;

  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsOptional()
  @IsNumber()
  lunarBirthYear?: number;

  @IsOptional()
  @IsString()
  activity?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CoachingFeedbackDto)
  coaching?: CoachingFeedbackDto;
}