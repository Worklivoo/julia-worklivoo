import { z } from 'zod'

// Schema para validação de login
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres')
})

// Schema para validação de registro
export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(6, 'Senha deve ter pelo menos 6 caracteres'),
  user_tipo: z.enum(['Loja de Carros', 'Imobiliaria', 'Outros'], {
    required_error: 'Selecione o tipo de cliente'
  }),
  plano_usuario: z.enum(['Growth', 'Essencial'], {
    required_error: 'Selecione o plano do usuário'
  }),
  ciclo_plano: z.enum(['Mensal', 'Trimestral', 'Anual'], {
    required_error: 'Selecione o ciclo do plano'
  }),
  prompt_cliente: z.string().min(1, 'Prompt do cliente é obrigatório'),
  telefone: z.string()
    .regex(/^55\d{10,11}$/, 'Telefone deve estar no formato 5512999999999'),
  empresa: z.string().min(1, 'Empresa é obrigatória'),
  whatsapp_grupo_link: z.string().optional().or(z.literal('')),
  leads_volume: z.coerce.number().min(1, 'Informe um volume válido'),
  valor_plano: z.string()
    .min(1, 'Valor do plano é obrigatório')
    .regex(/^\d{1,3}(\.\d{3})*,\d{2}$/, 'Informe um valor válido. Ex: 297,00')
})

// Tipos TypeScript derivados dos schemas
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
