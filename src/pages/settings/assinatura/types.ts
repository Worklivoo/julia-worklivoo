export interface Payment {
  id: string;
  value: number;
  status: string;
  clientPaymentDate: string | null;
  dateCreated: string;
  invoiceUrl: string;
  description: string | null;
}

export interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

