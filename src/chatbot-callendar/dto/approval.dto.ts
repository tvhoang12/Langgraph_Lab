import { IsEnum, IsString, IsOptional, IsObject, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ApprovalActionEnum {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  MODIFY = 'MODIFY',
}

export class SubmitApprovalDto {
  @IsString()
  approvalId: string;

  @IsString()
  userId: string;

  @IsEnum(ApprovalActionEnum)
  action: ApprovalActionEnum;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  modifiedData?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      'Session ID (optional - pass to get AI response directly - Cách 2)',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Lunar birth year (optional - for AI context in Cách 2)',
  })
  @IsOptional()
  @IsNumber()
  lunarBirthYear?: number;

  @ApiPropertyOptional({
    description: 'Activity type (optional - for AI context in Cách 2)',
  })
  @IsOptional()
  @IsString()
  activity?: string;
}

export class GetPendingApprovalsDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED';
}
