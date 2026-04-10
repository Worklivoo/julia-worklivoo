import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useCRM } from '@/contexts/CRMContext';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '@/schemas/auth';

const Auth = () => {
  const [resetEmail, setResetEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [loginError, setLoginError] = useState('');
  const { login } = useCRM();
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
    setLoginError('');
    const result = await login(data.email, data.password);
    if (result.success) {
      navigate('/inicio');
    } else {
      setLoginError(result.error || 'Falha ao entrar. Verifique suas credenciais.');
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
              {showForgotPassword
                ? 'Digite seu email para receber o link de recuperação'
                : 'Entre com suas credenciais'}
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
              <>
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
                  {loginError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{loginError}</p>
                    </div>
                  )}
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
                  <div className="flex flex-col items-center gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-gray-400 hover:text-gray-500 transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                </form>
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

export default Auth;
