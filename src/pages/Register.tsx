import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCRM } from '@/contexts/CRMContext';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone, Building, HelpCircle, DollarSign } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormData } from '@/schemas/auth';

const Register = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  
  // Novo estado para controlar a verificação inicial
  const [isAuthVerified, setIsAuthVerified] = useState(false);
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  
  const { register } = useCRM();
  const navigate = useNavigate();

  // Configuração do formulário de registro com validação
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      user_tipo: 'Imobiliaria',
      telefone: '',
      empresa: '',
      leads_volume: 100,
      valor_plano: ''
    }
  });

  const handleVerifyAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const authPassword = import.meta.env.VITE_AUTH_PASSWORD;
    
    if (authPasswordInput === authPassword) {
      setIsAuthVerified(true);
    } else {
      alert('Senha de autenticação inválida. Entre em contato com o administrador.');
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    // A verificação já foi feita no início, então apenas prosseguimos
    setIsLoading(true);

    // Formatar o valor do plano para usar ponto como separador decimal
    let formattedValorPlano = data.valor_plano.replace(/[R$\s]/g, ''); // Remove R$ e espaços
    
    if (formattedValorPlano.includes(',')) {
      // Se tem vírgula, assume formato brasileiro (ex: 1.500,50)
      // Remove pontos de milhar e substitui vírgula por ponto
      formattedValorPlano = formattedValorPlano.replace(/\./g, '').replace(',', '.');
    }
    // Se não tem vírgula mas tem ponto (ex: 1500.50), mantém como está

    const success = await register(
      data.name,
      data.email,
      data.password,
      data.telefone,
      data.empresa,
      data.user_tipo,
      data.leads_volume,
      formattedValorPlano
    );
    if (success) {
      // Após registro bem-sucedido, redirecionar para login
      alert('Usuário registrado com sucesso! Faça login para continuar.');
      navigate('/auth'); // Redireciona para login
      registerForm.reset(); // Limpa o formulário de registro
    } else {
      alert('Erro ao registrar usuário. Tente novamente.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor: '#F6F6F6'}}>
      <div className="w-full max-w-4xl">
        {/* Logo e Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img 
              src="/logo-worklivoo-amarela.png" 
              alt="Worklivoo" 
              className="h-16 w-auto rounded-xl shadow-lg"
            />
          </div>
        </div>

        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm rounded-3xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-center text-2xl font-semibold text-slate-900">
              {isAuthVerified ? 'Registrar Novo Cliente' : 'Autenticação Necessária'}
            </CardTitle>
            <CardDescription className="text-center text-slate-600">
              {isAuthVerified 
                ? 'Preencha os dados do novo cliente para criar acesso.'
                : 'Para acessar o formulário de registro, informe a senha de autenticação.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isAuthVerified ? (
              // Tela de Verificação de Senha
              <form onSubmit={handleVerifyAuth} className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 justify-center">
                    <Label htmlFor="auth-gate-password" className="text-sm font-medium text-slate-700">Senha de Autenticação</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-slate-400 hover:text-slate-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Senha usada internamente pela equipe da Worklivoo</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <Input
                      id="auth-gate-password"
                      type="password"
                      placeholder="Digite a senha de autenticação"
                      value={authPasswordInput}
                      onChange={(e) => setAuthPasswordInput(e.target.value)}
                      className="pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900"
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-500 text-center">Entre em contato com o administrador para obter a senha</p>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-black hover:bg-gray-800 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 mt-4 transform hover:scale-[1.02]"
                >
                  Verificar Acesso
                </Button>
                
                <div className="flex justify-center mt-6">
                  <Link to="/auth" className="text-sm text-slate-600 hover:text-slate-900 font-medium">
                    Voltar para Login
                  </Link>
                </div>
              </form>
            ) : (
              // Formulário de Registro (sem o campo de senha de autenticação)
              <>
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium text-slate-700">Nome completo <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                          id="name"
                          type="text"
                          placeholder="Seu nome completo"
                          {...registerForm.register('name')}
                          required
                          className={`pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${registerForm.formState.errors.name ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {registerForm.formState.errors.name && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="text-sm font-medium text-slate-700">E-mail <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="seu@email.com"
                          {...registerForm.register('email')}
                          required
                          className={`pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${registerForm.formState.errors.email ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {registerForm.formState.errors.email && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-sm font-medium text-slate-700">Senha <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                          id="register-password"
                          type={showRegisterPassword ? 'text' : 'password'}
                          placeholder="Crie uma senha segura"
                          {...registerForm.register('password')}
                          required
                          className={`pl-10 pr-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${registerForm.formState.errors.password ? 'border-red-500' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.password.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="user-tipo" className="text-sm font-medium text-slate-700">Escolha o tipo de cliente <span className="text-red-500">*</span></Label>
                      <Select value={registerForm.watch('user_tipo')} onValueChange={(v) => registerForm.setValue('user_tipo', v as RegisterFormData['user_tipo'])}>
                        <SelectTrigger className="w-full h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Imobiliaria" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Imobiliaria</SelectItem>
                          <SelectItem value="Carro" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Carro</SelectItem>
                          <SelectItem value="Outros" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                      {registerForm.formState.errors.user_tipo && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.user_tipo.message as string}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium text-slate-700">Telefone <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                          id="phone"
                          type="text"
                          placeholder="(11) 99999-9999"
                          {...registerForm.register('telefone')}
                          required
                          className={`pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${registerForm.formState.errors.telefone ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {registerForm.formState.errors.telefone && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.telefone.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="leads-volume" className="text-sm font-medium text-slate-700">Volume de Leads/mês <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Input
                          id="leads-volume"
                          type="number"
                          min={1}
                          placeholder="Ex.: 100"
                          {...registerForm.register('leads_volume', { valueAsNumber: true })}
                          required
                          className={`h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${registerForm.formState.errors.leads_volume ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {registerForm.formState.errors.leads_volume && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.leads_volume.message as string}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company" className="text-sm font-medium text-slate-700">Empresa <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                          id="company"
                          type="text"
                          placeholder="Nome da empresa"
                          {...registerForm.register('empresa')}
                          required
                          className={`pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${registerForm.formState.errors.empresa ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {registerForm.formState.errors.empresa && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.empresa.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="valor-plano" className="text-sm font-medium text-slate-700">Valor do Plano <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                          id="valor-plano"
                          type="text"
                          placeholder="Ex.: 297,00"
                          {...registerForm.register('valor_plano')}
                          required
                          className={`pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${registerForm.formState.errors.valor_plano ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {registerForm.formState.errors.valor_plano && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.valor_plano.message as string}</p>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-black hover:bg-gray-800 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 mt-4 transform hover:scale-[1.02]"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Criando conta...
                      </div>
                    ) : (
                      'Criar minha conta'
                    )}
                  </Button>
                </form>

                <div className="flex justify-center mt-6">
                  <Link to="/auth" className="text-sm text-slate-600 hover:text-slate-900 font-medium">
                    Já possui uma conta? Entre
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* Footer */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-sm text-slate-500">
            © 2025 Worklivoo. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
