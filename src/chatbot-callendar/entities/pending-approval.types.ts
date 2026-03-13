export interface PendingApproval {
  id: string;
  sessionId: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED';
  toolName: string;
  toolInput: Record<string, any>;
  toolOutput: Record<string, any>;
  userNotes?: string;
  modifiedOutput?: Record<string, any>;
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  conversationContext?: {
    userMessage: string;
    aiDecision: string;
  };
}

export interface ApprovalAction {
  action: 'APPROVE' | 'REJECT' | 'MODIFY';
  notes?: string;
  modifiedData?: Record<string, any>;
  approvedBy: string;
}

export default PendingApproval;
