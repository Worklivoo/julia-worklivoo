import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCRM } from '@/contexts/CRMContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone, Building, ArrowLeft, HelpCircle } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { usePersistentTab } from '@/hooks/use-persistent-state';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, registerSchema, LoginFormData, RegisterFormData } from '@/schemas/auth';

const Auth = () => {
  const [activeTab, setActiveTab] = usePersistentTab('auth', 'login');
  const [resetEmail, setResetEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const { login, register } = useCRM();
  const navigate = useNavigate();

  // Configuração do formulário de login com validação
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    const success = await login(data.email, data.password);
    if (success) {
      navigate('/inicio');
    }
    setIsLoading(false);
  };

  // Configuração do formulário de registro com validação
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      user_tipo: 'Imobiliaria',
      telefone: '',
      empresa: ''
    }
  });

  const handleRegister = async (data: RegisterFormData) => {
    // Verificar senha de autenticação
    const authPassword = import.meta.env.VITE_AUTH_PASSWORD;
    const authPasswordInput = (document.getElementById('auth-password') as HTMLInputElement)?.value;
    if (authPasswordInput !== authPassword) {
      alert('Senha de autenticação inválida. Entre em contato com o administrador.');
      return;
    }
    
    setIsLoading(true);
    const success = await register(
      data.name,
      data.email,
      data.password,
      data.telefone,
      data.empresa,
      data.user_tipo
    );
    if (success) {
      // Após registro bem-sucedido, redirecionar para login
      alert('Usuário registrado com sucesso! Faça login para continuar.');
      setActiveTab('login'); // Muda para a aba de login
      registerForm.reset(); // Limpa o formulário de registro
    } else {
      alert('Erro ao registrar usuário. Tente novamente.');
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResetMessage('');
    setResetError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        setResetError('Erro ao enviar email de recuperação. Verifique se o email está correto.');
      } else {
        setResetMessage('Email de recuperação enviado! Verifique sua caixa de entrada.');
        setResetEmail('');
      }
    } catch (error) {
      setResetError('Erro inesperado. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor: '#F6F6F6'}}>
      <div className="w-full max-w-md">
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
              {showForgotPassword ? 'Recuperar senha' : 'Acesse sua conta'}
            </CardTitle>
            <CardDescription className="text-center text-slate-600">
              {showForgotPassword ? 'Digite seu email para receber o link de recuperação' : 'Entre com suas credenciais ou crie uma nova conta'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showForgotPassword ? (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetMessage('');
                      setResetError('');
                      setResetEmail('');
                    }}
                    className="text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-slate-600">Voltar ao login</span>
                </div>
                
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-sm font-medium text-slate-700">
                      E-mail
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900"
                        required
                      />
                    </div>
                  </div>
                  
                  {resetMessage && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">{resetMessage}</p>
            </div>
                  )}
                  
                  {resetError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{resetError}</p>
            </div>
                  )}
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Enviando...
                      </div>
                    ) : (
                      "Enviar link de recuperação"
                    )}
                  </Button>
                </form>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 p-1 rounded-lg" style={{backgroundColor: 'rgba(235, 245, 125, 0.3)'}}>
                  <TabsTrigger 
                    value="login" 
                    className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                  >
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger 
                      value="register" 
                      className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                    >
                      Registrar
                    </TabsTrigger>
                </TabsList>

              <TabsContent value="login" className="space-y-6 mt-6">
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                        E-mail
                      </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        {...loginForm.register('email')}
                        className={`pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${
                          loginForm.formState.errors.email ? 'border-red-500' : ''
                        }`}
                      />
                    </div>
                    {loginForm.formState.errors.email && (
                      <p className="text-sm text-red-600">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                        Senha
                      </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite sua senha"
                        {...loginForm.register('password')}
                        className={`pl-10 pr-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${
                          loginForm.formState.errors.password ? 'border-red-500' : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-red-600">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-black hover:bg-gray-800 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Entrando...
                      </div>
                    ) : (
                      "Entrar na conta"
                    )}
                  </Button>
                  <div className="flex justify-center mt-4">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-gray-400 hover:text-gray-500 transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register" className="space-y-6 mt-6">
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                        Nome completo
                      </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Seu nome completo"
                        {...registerForm.register('name')}
                        className={`pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${
                          registerForm.formState.errors.name ? 'border-red-500' : ''
                        }`}
                      />
                    </div>
                    {registerForm.formState.errors.name && (
                      <p className="text-sm text-red-600">{registerForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-sm font-medium text-slate-700">
                        E-mail
                      </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="seu@email.com"
                        {...registerForm.register('email')}
                        className={`pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${
                          registerForm.formState.errors.email ? 'border-red-500' : ''
                        }`}
                      />
                    </div>
                    {registerForm.formState.errors.email && (
                      <p className="text-sm text-red-600">{registerForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-sm font-medium text-slate-700">
                      Senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="register-password"
                        type={showRegisterPassword ? "text" : "password"}
                        placeholder="Crie uma senha segura"
                        {...registerForm.register('password')}
                        className={`pl-10 pr-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${
                          registerForm.formState.errors.password ? 'border-red-500' : ''
                        }`}
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
                    <div className="flex items-center gap-2">
                      <Label htmlFor="auth-password" className="text-sm font-medium text-slate-700">
                        Senha de Autenticação <span className="text-red-500">*</span>
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Senha usada internamente pela equipe da Worklivoo, entre em contato conosco</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                          id="auth-password"
                          type="password"
                          placeholder="Digite a senha de autenticação"
                          className="pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900"
                          required
                        />
                    </div>
                    <p className="text-xs text-slate-500">
                      Entre em contato com o administrador para obter a senha de autenticação
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-tipo" className="text-sm font-medium text-slate-700">
                      Escolha o tipo de cliente
                    </Label>
                    <Select value={registerForm.watch('user_tipo')} onValueChange={(v) => registerForm.setValue('user_tipo', v)}>
                      <SelectTrigger className="w-full h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Imobiliaria" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Imobiliaria</SelectItem>
                        <SelectItem value="Carro" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Carro</SelectItem>
                      </SelectContent>
                    </Select>
                    {registerForm.formState.errors.user_tipo && (
                      <p className="text-sm text-red-600">{registerForm.formState.errors.user_tipo.message as string}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
                        Telefone <span className="text-slate-400">(opcional)</span>
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                          id="phone"
                          type="text"
                          placeholder="(11) 99999-9999"
                          {...registerForm.register('telefone')}
                          className={`pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${
                            registerForm.formState.errors.telefone ? 'border-red-500' : ''
                          }`}
                        />
                      </div>
                      {registerForm.formState.errors.telefone && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.telefone.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company" className="text-sm font-medium text-slate-700">
                        Empresa <span className="text-slate-400">(opcional)</span>
                      </Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                          id="company"
                          type="text"
                          placeholder="Nome da empresa"
                          {...registerForm.register('empresa')}
                          className={`pl-10 h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 ${
                            registerForm.formState.errors.empresa ? 'border-red-500' : ''
                          }`}
                        />
                      </div>
                      {registerForm.formState.errors.empresa && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.empresa.message}</p>
                      )}
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-black hover:bg-gray-800 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 mt-6 transform hover:scale-[1.02]"
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
              </TabsContent>
            </Tabs>
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

export default Auth;
