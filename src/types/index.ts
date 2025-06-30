
export interface Lead {
  id: string;
  opportunityName: string;
  leadName: string;
  email: string;
  phone: string;
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  status: 'active' | 'won' | 'lost';
  value: number;
  createdAt: Date;
  updatedAt: Date;
  source: string;
  lossReason?: string;
  notes: Note[];
  priority: 'low' | 'medium' | 'high';
  expectedCloseDate?: Date;
}

export interface Note {
  id: string;
  leadId: string;
  content: string;
  createdAt: Date;
  author: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface DashboardMetrics {
  totalLeads: number;
  totalValue: number;
  conversionRate: number;
  avgDealSize: number;
  leadsThisMonth: number;
  wonDeals: number;
  lostDeals: number;
  pipelineValue: number;
}
