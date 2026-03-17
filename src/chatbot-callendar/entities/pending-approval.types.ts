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
  coachingFeedback?: CoachingFeedback;
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  conversationContext?: {
    userMessage: string;
    aiDecision: string;
  };
}

export interface CoachingFeedback {
  errorType?: 'HALLUCINATION' | 'POLICY' | 'FORMAT' | 'DOMAIN' | 'OTHER';
  reason: string;
  correction?: string;            
  tags?: string[];               
  confidence?: number;            
  coachedBy?: string;
  coachedAt?: Date;
}


export interface ApprovalAction {
  action: 'APPROVE' | 'REJECT' | 'MODIFY';
  notes?: string;
  modifiedData?: Record<string, any>;
  approvedBy: string;
  coaching?:CoachingFeedback;
}

export default PendingApproval;
