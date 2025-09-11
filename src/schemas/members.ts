import { z } from 'zod';

// Schema para criação de membros
export const memberSchema = z.object({
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
  
  cargo: z.string()
    .min(2, 'Cargo deve ter pelo menos 2 caracteres')
    .max(50, 'Cargo deve ter no máximo 50 caracteres'),
  
  departamento: z.string()
    .min(2, 'Departamento deve ter pelo menos 2 caracteres')
    .max(50, 'Departamento deve ter no máximo 50 caracteres')
    .optional(),
  
  nivel_acesso: z.enum(['admin', 'gerente', 'vendedor', 'usuario'])
    .default('usuario'),
  
  status: z.enum(['ativo', 'inativo', 'pendente'])
    .default('ativo'),
  
  data_admissao: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional(),
  
  observacoes: z.string()
    .max(500, 'Observações devem ter no máximo 500 caracteres')
    .optional()
});

// Schema para atualização de membros (todos os campos opcionais)
export const updateMemberSchema = memberSchema.partial();

// Tipos TypeScript derivados dos schemas
export type MemberFormData = z.infer<typeof memberSchema>;
export type UpdateMemberFormData = z.infer<typeof updateMemberSchema>;