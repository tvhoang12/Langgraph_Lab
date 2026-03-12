import { IsEnum, IsString, IsOptional, IsObject } from 'class-validator';

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
}

export class GetPendingApprovalsDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED';
}
