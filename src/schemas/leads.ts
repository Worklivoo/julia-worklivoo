import { z } from 'zod';

// Schema para criação de leads
export const leadSchema = z.object({
  nome: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  
  email: z.string()
    .email('E-mail inválido')
    .min(1, 'E-mail é obrigatório'),
  
  telefone: z.string()
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(15, 'Telefone deve ter no máximo 15 dígitos')
    .regex(/^[\d\s\(\)\-\+]+$/, 'Formato de telefone inválido'),
  
  empresa: z.string()
    .min(2, 'Nome da empresa deve ter pelo menos 2 caracteres')
    .max(100, 'Nome da empresa deve ter no máximo 100 caracteres'),
  
  cargo: z.string()
    .min(2, 'Cargo deve ter pelo menos 2 caracteres')
    .max(50, 'Cargo deve ter no máximo 50 caracteres')
    .optional(),
  
  origem: z.string()
    .min(1, 'Origem é obrigatória'),
  
  status: z.enum(['novo', 'contatado', 'qualificado', 'proposta', 'fechado', 'perdido'])
    .default('novo'),
  
  observacoes: z.string()
    .max(500, 'Observações devem ter no máximo 500 caracteres')
    .optional()
});

// Schema para atualização de leads (todos os campos opcionais)
export const updateLeadSchema = leadSchema.partial();

// Tipos TypeScript derivados dos schemas
export type LeadFormData = z.infer<typeof leadSchema>;
export type UpdateLeadFormData = z.infer<typeof updateLeadSchema>;