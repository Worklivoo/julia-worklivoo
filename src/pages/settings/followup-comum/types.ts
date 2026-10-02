export type FollowUpPagamentoStatus = 'PENDING' | 'RECEIVED' | 'CANCELLED' | 'EXPIRED';

export interface FollowUpCicloInfo {
  inicio: string;
  fim: string;
  diaVencimento: number;
  diasRestantes: number;
}

export interface FollowUpPixInfo {
  payload: string;
  base64?: string | null;
  qrCodeImageUrl?: string | null;
  expirationDate?: string | null;
}

export interface FollowUpPagamento {
  paymentId: string;
  externalReference: string;
  status: FollowUpPagamentoStatus;
  planoId: string;
  valorRateio: number;
  valorPlanoCheio: number;
  valorProxFatura: number;
  ciclo: FollowUpCicloInfo;
  pix: FollowUpPixInfo;
  createdAt: number;
  lastPolledAt?: number | null;
  completedAt?: number | null;
  pipelineExecutado?: boolean;
  pipelineErro?: string | null;
  dadosCliente?: {
    nome?: string;
    empresa?: string;
  };
}
