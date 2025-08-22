import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useCRM } from '@/contexts/CRMContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone, Building, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const Auth = () => {
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ name: '', email: '', password: '', telefone: '', empresa: '', authPassword: '' });
  const [resetEmail, setResetEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const { login, register } = useCRM();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const success = await login(loginData.email, loginData.password);
    if (success) {
      navigate('/inicio');
    }
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar senha de autenticação
    if (registerData.authPassword !== 'W0rkliv0o!2025') {
      alert('Senha de autenticação inválida. Entre em contato com o administrador.');
      return;
    }
    
    setIsLoading(true);
    const success = await register(
      registerData.name,
      registerData.email,
      registerData.password,
      registerData.telefone,
      registerData.empresa
    );
    if (success) {
      navigate('/inicio');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Bem-vindo de volta</h1>
          <p className="text-slate-600 dark:text-slate-400">Acesse sua conta ou crie uma nova</p>
        </div>

        <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-center text-2xl font-semibold text-slate-900 dark:text-white">
              {showForgotPassword ? 'Recuperar senha' : 'Acesse sua conta'}
            </CardTitle>
            <CardDescription className="text-center text-slate-600 dark:text-slate-400">
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
                    className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">Voltar ao login</span>
                </div>
                
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
                        className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus:border-yellow-500 dark:focus:border-yellow-400 focus:ring-yellow-500/20"
                        required
                      />
                    </div>
                  </div>
                  
                  {resetMessage && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-400">{resetMessage}</p>
                    </div>
                  )}
                  
                  {resetError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-700 dark:text-red-400">{resetError}</p>
                    </div>
                  )}
                  
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Enviando...
                      </div>
                    ) : (
                      'Enviar link de recuperação'
                    )}
                  </Button>
                </form>
              </div>
            ) : (
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                  <TabsTrigger 
                    value="login" 
                    className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white"
                  >
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger 
                    value="register"
                    className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white"
                  >
                    Criar conta
                  </TabsTrigger>
                </TabsList>

              <TabsContent value="login" className="space-y-6 mt-6">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      E-mail
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={loginData.email}
                        onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                        className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus:border-yellow-500 dark:focus:border-yellow-400 focus:ring-yellow-500/20"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite sua senha"
                        value={loginData.password}
                        onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                        className="pl-10 pr-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus:border-yellow-500 dark:focus:border-yellow-400 focus:ring-yellow-500/20"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 font-medium transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Entrando...
                      </div>
                    ) : (
                      'Entrar na conta'
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="space-y-6 mt-6">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Nome completo
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Seu nome completo"
                        value={registerData.name}
                        onChange={(e) => setRegisterData({...registerData, name: e.target.value})}
                        className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus:border-yellow-500 dark:focus:border-yellow-400 focus:ring-yellow-500/20"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      E-mail
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                        className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus:border-yellow-500 dark:focus:border-yellow-400 focus:ring-yellow-500/20"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="register-password"
                        type={showRegisterPassword ? "text" : "password"}
                        placeholder="Crie uma senha segura"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                        className="pl-10 pr-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus:border-yellow-500 dark:focus:border-yellow-400 focus:ring-yellow-500/20"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auth-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Senha de Autenticação <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        id="auth-password"
                        type="password"
                        placeholder="Digite a senha de autenticação"
                        value={registerData.authPassword}
                        onChange={(e) => setRegisterData({...registerData, authPassword: e.target.value})}
                        className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus:border-yellow-500 dark:focus:border-yellow-400 focus:ring-yellow-500/20"
                        required
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Entre em contato com o administrador para obter a senha de autenticação
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Telefone <span className="text-slate-400">(opcional)</span>
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                          id="phone"
                          type="text"
                          placeholder="(11) 99999-9999"
                          value={registerData.telefone}
                          onChange={(e) => setRegisterData({...registerData, telefone: e.target.value})}
                          className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus:border-yellow-500 dark:focus:border-yellow-400 focus:ring-yellow-500/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Empresa <span className="text-slate-400">(opcional)</span>
                      </Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <Input
                          id="company"
                          type="text"
                          placeholder="Nome da empresa"
                          value={registerData.empresa}
                          onChange={(e) => setRegisterData({...registerData, empresa: e.target.value})}
                          className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus:border-yellow-500 dark:focus:border-yellow-400 focus:ring-yellow-500/20"
                        />
                      </div>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 mt-6"
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © 2024 Worklivoo. Todos os direitos reservados.
          </p>

        </div>
      </div>
    </div>
  );
};

export default Auth;
