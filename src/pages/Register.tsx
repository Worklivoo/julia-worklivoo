import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCRM } from '@/contexts/CRMContext';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Mail, Lock, User, Phone, Building, DollarSign } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormData } from '@/schemas/auth';
import { DEFAULT_PROMPTS } from '@/constants/prompts';

const Registrar = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [isWhatsappGroupValidated, setIsWhatsappGroupValidated] = useState(false);
  const [isWhatsappGroupValidating, setIsWhatsappGroupValidating] = useState(false);
  const [whatsappGroupValidationError, setWhatsappGroupValidationError] = useState<string | null>(null);
  const [whatsappGroupValidationSuccess, setWhatsappGroupValidationSuccess] = useState<string | null>(null);
  
  // Novo estado para controlar a verificação inicial
  const [isAuthVerified, setIsAuthVerified] = useState(false);
  const [authPasswordInput, setAuthPasswordInput] = useState('');

  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [progressError, setProgressError] = useState<string | null>(null);
  
  const { register } = useCRM();
  const navigate = useNavigate();

  const normalizeTelefoneRest = (value: string) => value.replace(/\D/g, '').slice(0, 11);
  const normalizeCurrencyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 12);

  const formatCurrencyValue = (value: string) => {
    const digits = normalizeCurrencyDigits(value);
    if (!digits) return '';

    const padded = digits.padStart(3, '0');
    const cents = padded.slice(-2);
    const integerDigits = padded.slice(0, -2);
    const integer = Number(integerDigits).toLocaleString('pt-BR');

    return `${integer},${cents}`;
  };

  const normalizeEmpresaLive = (value: string) => {
    const noDiacritics = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleaned = noDiacritics.replace(/[^A-Za-z0-9 ]+/g, ' ');
    return cleaned.toUpperCase();
  };

  const normalizeEmpresaFinal = (value: string) => normalizeEmpresaLive(value).replace(/\s+/g, ' ').trim();

  // Configuração do formulário de registro com validação
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      user_tipo: 'Loja de Carros',
      plano_usuario: 'Growth',
      ciclo_plano: 'Mensal',
      prompt_cliente: '',
      telefone: '55',
      empresa: '',
      whatsapp_grupo_link: '',
      leads_volume: 100,
      valor_plano: ''
    }
  });

  const userTipoWatch = registerForm.watch('user_tipo');
  const whatsappGroupField = registerForm.register('whatsapp_grupo_link');
  const valorPlanoField = registerForm.register('valor_plano');

  useEffect(() => {
    if (userTipoWatch && DEFAULT_PROMPTS[userTipoWatch as keyof typeof DEFAULT_PROMPTS]) {
      registerForm.setValue('prompt_cliente', DEFAULT_PROMPTS[userTipoWatch as keyof typeof DEFAULT_PROMPTS], {
        shouldValidate: true,
        shouldDirty: true
      });
    }
  }, [userTipoWatch, registerForm]);

  const handleAdvanceStep = async () => {
    const whatsappGroupLink = String(registerForm.getValues('whatsapp_grupo_link') || '').trim();
    if (whatsappGroupLink && !isWhatsappGroupValidated) {
      setWhatsappGroupValidationError('Clique em validar para considerar o ID do grupo do WhatsApp.');
      return;
    }

    const isStepValid = await registerForm.trigger([
      'name',
      'email',
      'telefone',
      'empresa',
      'user_tipo',
      'leads_volume',
      'valor_plano',
      'password'
    ]);

    if (isStepValid) {
      setRegisterStep(2);
    }
  };

  const validateWhatsappGroupLink = () => {
    const raw = String(registerForm.getValues('whatsapp_grupo_link') || '').trim();
    if (!raw) {
      setWhatsappGroupValidationError('Informe o link do grupo do WhatsApp para validar.');
      setIsWhatsappGroupValidated(false);
      return;
    }

    const run = async () => {
      setIsWhatsappGroupValidating(true);
      setWhatsappGroupValidationError(null);
      setWhatsappGroupValidationSuccess(null);

      const normalized = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;

      let baseLink = '';
      try {
        const url = new URL(normalized);
        if (url.hostname !== 'chat.whatsapp.com') {
          setWhatsappGroupValidationError('Link inválido. Use um convite do chat.whatsapp.com.');
          setIsWhatsappGroupValidated(false);
          return;
        }
        const code = String(url.pathname || '').replace(/^\/+/, '').split('/')[0];
        if (!code || !/^[A-Za-z0-9]+$/.test(code)) {
          setWhatsappGroupValidationError('Link inválido. Cole um convite válido do grupo.');
          setIsWhatsappGroupValidated(false);
          return;
        }
        baseLink = `https://chat.whatsapp.com/${code}`;
      } catch {
        setWhatsappGroupValidationError('Link inválido. Cole uma URL completa.');
        setIsWhatsappGroupValidated(false);
        return;
      }

      registerForm.setValue('whatsapp_grupo_link', baseLink, { shouldDirty: true, shouldValidate: true });

      try {
        const res = await fetch('https://worklivoo.uazapi.com/group/inviteInfo', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            token: '62e17a7e-e77e-4024-9776-137127e1bcfe',
          },
          body: JSON.stringify({ invitecode: baseLink }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = String(json?.message || json?.error || json?.response || '').trim();
          setWhatsappGroupValidationError(msg || `Erro ao validar o grupo. Status ${res.status}.`);
          setIsWhatsappGroupValidated(false);
          return;
        }

        const jid = json?.group?.JID;
        if (!jid || typeof jid !== 'string') {
          setWhatsappGroupValidationError('Não foi possível obter o JID do grupo.');
          setIsWhatsappGroupValidated(false);
          return;
        }

        registerForm.setValue('whatsapp_grupo_link', jid, { shouldDirty: true, shouldValidate: true });
        setIsWhatsappGroupValidated(true);
        const groupName = typeof json?.group?.Name === 'string' ? json.group.Name : null;
        setWhatsappGroupValidationSuccess(groupName ? `Grupo validado: ${groupName}` : 'Grupo validado com sucesso.');
      } catch (err: any) {
        setWhatsappGroupValidationError(err?.message || 'Erro ao validar o grupo.');
        setIsWhatsappGroupValidated(false);
      } finally {
        setIsWhatsappGroupValidating(false);
      }
    };

    void run();
  };

  const handleVerifyAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const authPassword = import.meta.env.VITE_AUTH_PASSWORD;
    
    if (authPasswordInput === authPassword) {
      setIsAuthVerified(true);
    } else {
      alert('Senha de autenticação inválida. Entre em contato com o administrador.');
    }
  };

  const createUazapiInstance = async (empresaNome: string) => {
    const adminToken = import.meta.env.VITE_UAZAPI_ADMIN_TOKEN as string | undefined;
    if (!adminToken) {
      throw new Error('Token do Uazapi não configurado');
    }

    const res = await fetch('https://worklivoo.uazapi.com/instance/init', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        admintoken: adminToken,
      },
      body: JSON.stringify({ name: empresaNome }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error('Erro ao criar instância no Uazapi');
    }

    const token =
      json?.instance?.token ??
      json?.data?.instance?.token ??
      json?.token ??
      json?.data?.token;

    if (!token || typeof token !== 'string') {
      throw new Error('Token da instância não retornado pelo Uazapi');
    }

    return token;
  };

  const createUazapiWebhook = async (instanceToken: string, payload: any) => {
    const res = await fetch('https://worklivoo.uazapi.com/webhook', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        token: instanceToken,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error('Erro ao criar webhook no Uazapi');
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    setIsProgressOpen(true);
    setProgressError(null);
    setProgressPercent(5);
    setProgressStatus('Criando usuário no Supabase...');
    setIsLoading(true);

    const whatsappGroupLink = String(data.whatsapp_grupo_link || '').trim();
    if (whatsappGroupLink && !isWhatsappGroupValidated) {
      setIsLoading(false);
      setIsProgressOpen(false);
      setWhatsappGroupValidationError('Clique em validar para considerar o ID do grupo do WhatsApp.');
      return;
    }

    const grupoWhatsappId = isWhatsappGroupValidated ? (whatsappGroupLink || null) : null;

    const normalizedEmpresa = normalizeEmpresaFinal(data.empresa);
    const promptToSave = String(data.prompt_cliente || '').replace(/worklivoo/gi, normalizedEmpresa);

    // Formatar o valor do plano para usar ponto como separador decimal
    let formattedValorPlano = data.valor_plano.replace(/[R$\s]/g, ''); // Remove R$ e espaços
    
    if (formattedValorPlano.includes(',')) {
      // Se tem vírgula, assume formato brasileiro (ex: 1.500,50)
      // Remove pontos de milhar e substitui vírgula por ponto
      formattedValorPlano = formattedValorPlano.replace(/\./g, '').replace(',', '.');
    }
    // Se não tem vírgula mas tem ponto (ex: 1500.50), mantém como está

    try {
      const registerResult = await register(
        data.name,
        data.email,
        data.password,
        data.telefone,
        normalizedEmpresa,
        data.user_tipo,
        data.leads_volume,
        formattedValorPlano,
        data.plano_usuario,
        data.ciclo_plano,
        promptToSave,
        grupoWhatsappId
      );

      if (!registerResult.success || !registerResult.userId) {
        throw new Error(registerResult.error || 'Erro ao criar usuário no Supabase');
      }

      setProgressPercent(35);
      setProgressStatus('Criando instância no Uazapi...');
      const instanceToken = await createUazapiInstance(normalizedEmpresa);

      const { error: updateTokenError } = await supabase
        .from('usuarios_v2')
        .update({ token_instancia_uazapi: instanceToken })
        .eq('user_id', registerResult.userId);

      if (updateTokenError) {
        throw new Error('Erro ao salvar token da instância no Supabase');
      }

      setProgressPercent(65);
      setProgressStatus('Criando webhook de conexão...');
      await createUazapiWebhook(instanceToken, {
        enabled: true,
        url: 'https://primary-production-d442.up.railway.app/webhook/desconectadoUazapi',
        action: 'add',
        events: ['connection'],
        excludeMessages: [],
      });

      setProgressPercent(85);
      setProgressStatus('Criando webhook de desativar a IA...');
      await createUazapiWebhook(instanceToken, {
        enabled: true,
        url: 'https://primary-production-d442.up.railway.app/webhook/sdjreniubtnjkfsdnvfozsjdkbn',
        action: 'add',
        events: ['messages'],
        excludeMessages: ['wasSentByApi', 'fromMeNo', 'isGroupYes'],
      });

      setProgressPercent(100);
      setProgressStatus('Concluído');

      // Delay artificial para garantir que o usuário veja a barra em 100% por um momento
      await new Promise(resolve => setTimeout(resolve, 5000));

      registerForm.reset();
      setRegisterStep(1);
      navigate('/auth');
      setIsProgressOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao finalizar cadastro';
      setProgressError(message);
      setProgressStatus('Erro');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClassName = (hasError: boolean) =>
    `h-12 rounded-xl bg-slate-50 border-slate-200 focus:border-primary focus:ring-primary/20 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-colors ${hasError ? 'border-red-500' : ''}`;

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-[#F6F6F6]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-28 -left-28 h-80 w-80 rounded-full bg-[#EBF57D]/45 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-slate-200/70 blur-3xl" />
      </div>
      <div className={`w-full ${isAuthVerified ? 'max-w-2xl' : 'max-w-md'}`}>
        <Card className="border-0 shadow-2xl bg-white/85 backdrop-blur-sm rounded-3xl ring-1 ring-black/5 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-[#EBF57D] via-[#EBF57D]/70 to-transparent" />
          {!isAuthVerified ? (
            <>
              <CardHeader className="items-center text-center space-y-2 pb-6 pt-10">
                <div className="h-14 w-14 rounded-2xl overflow-hidden shadow-md bg-white ring-1 ring-black/5">
                  <img
                    src="/logo-worklivoo-amarela.png"
                    alt="Worklivoo"
                    className="h-full w-full object-cover"
                  />
                </div>
                <CardTitle className="text-3xl font-semibold text-slate-900">Área Restrita</CardTitle>
                <CardDescription className="text-base text-slate-500">
                  Digite a chave de acesso para continuar
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 px-6 sm:px-8 pb-8">
                <form onSubmit={handleVerifyAuth} className="space-y-5">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <Input
                      id="auth-gate-password"
                      type="password"
                      placeholder="Senha de acesso"
                      value={authPasswordInput}
                      onChange={(e) => setAuthPasswordInput(e.target.value)}
                      className="pl-12 h-14 rounded-2xl bg-slate-50 border-slate-200 focus:border-primary focus:ring-primary/20 text-slate-900 placeholder:text-slate-400"
                      required
                      autoFocus
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-14 rounded-2xl bg-black hover:bg-black/90 active:bg-black text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.99] active:translate-y-px"
                  >
                    <span>Acessar Painel</span>
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>

                  <div className="pt-5 border-t border-slate-200 text-center text-xs text-slate-400 space-y-1">
                    <p>Protegido por criptografia de ponta a ponta.</p>
                    <p>Julia Worklivoo</p>
                  </div>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="px-6 sm:px-8 pt-10 pb-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl overflow-hidden bg-white ring-1 ring-black/5 shadow-sm">
                    <img
                      src="/logo-worklivoo-amarela.png"
                      alt="Worklivoo"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-semibold text-slate-900">Cadastro de Cliente</CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Preencha os dados abaixo para criar sua conta.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 px-6 sm:px-8 pb-10">
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-5">
                    {registerStep === 1 ? (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="name" className="text-xs font-semibold tracking-wider text-slate-500">NOME COMPLETO</Label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                            <Input
                              id="name"
                              type="text"
                              placeholder="Seu nome completo"
                              {...registerForm.register('name')}
                              required
                              className={`pl-11 ${inputClassName(!!registerForm.formState.errors.name)}`}
                            />
                          </div>
                          {registerForm.formState.errors.name && (
                            <p className="text-sm text-red-600">{registerForm.formState.errors.name.message}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                          <div className="space-y-1.5">
                            <Label htmlFor="register-email" className="text-xs font-semibold tracking-wider text-slate-500">E-MAIL</Label>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                              <Input
                                id="register-email"
                                type="email"
                                placeholder="seu@email.com"
                                {...registerForm.register('email')}
                                required
                                className={`pl-11 ${inputClassName(!!registerForm.formState.errors.email)}`}
                              />
                            </div>
                            {registerForm.formState.errors.email && (
                              <p className="text-sm text-red-600">{registerForm.formState.errors.email.message}</p>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="phone" className="text-xs font-semibold tracking-wider text-slate-500">TELEFONE</Label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                              <span className="absolute left-11 top-1/2 -translate-y-1/2 text-slate-600 text-sm font-medium select-none">55</span>
                              <Input
                                id="phone"
                                type="text"
                                inputMode="numeric"
                                placeholder="12999999999"
                                value={registerForm.watch('telefone').replace(/^55/, '')}
                                onChange={(e) => {
                                  const rest = normalizeTelefoneRest(e.target.value);
                                  registerForm.setValue('telefone', `55${rest}`, { shouldDirty: true, shouldValidate: true });
                                }}
                                onBlur={() => registerForm.trigger('telefone')}
                                required
                                className={`pl-16 ${inputClassName(!!registerForm.formState.errors.telefone)}`}
                              />
                            </div>
                            {registerForm.formState.errors.telefone && (
                              <p className="text-sm text-red-600">{registerForm.formState.errors.telefone.message}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                          <div className="space-y-1.5">
                            <Label htmlFor="company" className="text-xs font-semibold tracking-wider text-slate-500">NOME DA EMPRESA</Label>
                            <div className="relative">
                              <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                              <Input
                                id="company"
                                type="text"
                                placeholder="Nome da sua empresa"
                                value={registerForm.watch('empresa')}
                                onChange={(e) => {
                                  registerForm.setValue('empresa', normalizeEmpresaLive(e.target.value), { shouldDirty: true, shouldValidate: true });
                                }}
                                onBlur={() => {
                                  registerForm.setValue('empresa', normalizeEmpresaFinal(registerForm.getValues('empresa')), { shouldDirty: true, shouldValidate: true });
                                  registerForm.trigger('empresa');
                                }}
                                required
                                className={`pl-11 ${inputClassName(!!registerForm.formState.errors.empresa)}`}
                              />
                            </div>
                            {registerForm.formState.errors.empresa && (
                              <p className="text-sm text-red-600">{registerForm.formState.errors.empresa.message}</p>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="user-tipo" className="text-xs font-semibold tracking-wider text-slate-500">TIPO DE CLIENTE</Label>
                            <Select value={registerForm.watch('user_tipo')} onValueChange={(v) => registerForm.setValue('user_tipo', v as RegisterFormData['user_tipo'], { shouldDirty: true, shouldValidate: true })}>
                              <SelectTrigger className={`w-full ${inputClassName(!!registerForm.formState.errors.user_tipo)}`}>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Loja de Carros" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Loja de Carros</SelectItem>
                                <SelectItem value="Imobiliaria" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Imobiliaria</SelectItem>
                                <SelectItem value="Outros" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Outros</SelectItem>
                              </SelectContent>
                            </Select>
                            {registerForm.formState.errors.user_tipo && (
                              <p className="text-sm text-red-600">{registerForm.formState.errors.user_tipo.message as string}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="whatsapp-group-link" className="text-xs font-semibold tracking-wider text-slate-500">ID DO GRUPO DO WHATSAPP</Label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                              id="whatsapp-group-link"
                              type="text"
                              placeholder="Cole o link do convite do grupo"
                              {...whatsappGroupField}
                              onChange={(e) => {
                                whatsappGroupField.onChange(e);
                                setIsWhatsappGroupValidated(false);
                                setWhatsappGroupValidationError(null);
                                setWhatsappGroupValidationSuccess(null);
                              }}
                              className={inputClassName(!!whatsappGroupValidationError)}
                            />
                            <Button
                              type="button"
                              className="h-12 rounded-xl bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 shadow-sm"
                              onClick={validateWhatsappGroupLink}
                              disabled={isWhatsappGroupValidating}
                            >
                              {isWhatsappGroupValidating ? 'Validando...' : isWhatsappGroupValidated ? 'Validado' : 'Validar'}
                            </Button>
                          </div>
                          {whatsappGroupValidationError && (
                            <p className="text-sm text-red-600">{whatsappGroupValidationError}</p>
                          )}
                          {!whatsappGroupValidationError && whatsappGroupValidationSuccess && (
                            <p className="text-sm text-emerald-700">{whatsappGroupValidationSuccess}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                          <div className="space-y-1.5">
                            <Label htmlFor="leads-volume" className="text-xs font-semibold tracking-wider text-slate-500">VOLUME DE LEADS/MÊS</Label>
                            <Input
                              id="leads-volume"
                              type="number"
                              min={1}
                              placeholder="Ex.: 100"
                              {...registerForm.register('leads_volume', { valueAsNumber: true })}
                              required
                              className={inputClassName(!!registerForm.formState.errors.leads_volume)}
                            />
                            {registerForm.formState.errors.leads_volume && (
                              <p className="text-sm text-red-600">{registerForm.formState.errors.leads_volume.message as string}</p>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="valor-plano" className="text-xs font-semibold tracking-wider text-slate-500">VALOR DO PLANO</Label>
                            <div className="relative">
                              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                              <Input
                                id="valor-plano"
                                type="text"
                                inputMode="numeric"
                                placeholder="Ex.: 297,00"
                                {...valorPlanoField}
                                value={registerForm.watch('valor_plano')}
                                onChange={(e) => {
                                  registerForm.setValue('valor_plano', formatCurrencyValue(e.target.value), {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  });
                                }}
                                onBlur={() => registerForm.trigger('valor_plano')}
                                required
                                className={`pl-11 ${inputClassName(!!registerForm.formState.errors.valor_plano)}`}
                              />
                            </div>
                            {registerForm.formState.errors.valor_plano && (
                              <p className="text-sm text-red-600">{registerForm.formState.errors.valor_plano.message as string}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="register-password" className="text-xs font-semibold tracking-wider text-slate-500">SENHA DE ACESSO</Label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                            <Input
                              id="register-password"
                              type={showRegisterPassword ? 'text' : 'password'}
                              placeholder="Crie uma senha segura"
                              {...registerForm.register('password')}
                              required
                              className={`pl-11 pr-12 ${inputClassName(!!registerForm.formState.errors.password)}`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {registerForm.formState.errors.password && (
                            <p className="text-sm text-red-600">{registerForm.formState.errors.password.message}</p>
                          )}
                        </div>

                        <Button
                          type="button"
                          className="w-full h-14 rounded-2xl bg-black hover:bg-black/90 active:bg-black text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.99] active:translate-y-px"
                          onClick={handleAdvanceStep}
                        >
                          <span>Avançar</span>
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                          <div className="space-y-1.5">
                            <Label htmlFor="plano-usuario" className="text-xs font-semibold tracking-wider text-slate-500">PLANO DO USUÁRIO</Label>
                            <Select
                              value={registerForm.watch('plano_usuario')}
                              onValueChange={(v) => registerForm.setValue('plano_usuario', v as RegisterFormData['plano_usuario'])}
                            >
                              <SelectTrigger id="plano-usuario" className={`w-full ${inputClassName(!!registerForm.formState.errors.plano_usuario)}`}>
                                <SelectValue placeholder="Selecione o plano" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Growth" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Growth</SelectItem>
                                <SelectItem value="Essencial" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Essencial</SelectItem>
                              </SelectContent>
                            </Select>
                            {registerForm.formState.errors.plano_usuario && (
                              <p className="text-sm text-red-600">{registerForm.formState.errors.plano_usuario.message as string}</p>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="ciclo-plano" className="text-xs font-semibold tracking-wider text-slate-500">CICLO DO PLANO</Label>
                            <Select
                              value={registerForm.watch('ciclo_plano')}
                              onValueChange={(v) => registerForm.setValue('ciclo_plano', v as RegisterFormData['ciclo_plano'])}
                            >
                              <SelectTrigger id="ciclo-plano" className={`w-full ${inputClassName(!!registerForm.formState.errors.ciclo_plano)}`}>
                                <SelectValue placeholder="Selecione o ciclo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Mensal" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Mensal</SelectItem>
                                <SelectItem value="Trimestral" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Trimestral</SelectItem>
                                <SelectItem value="Anual" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Anual</SelectItem>
                              </SelectContent>
                            </Select>
                            {registerForm.formState.errors.ciclo_plano && (
                              <p className="text-sm text-red-600">{registerForm.formState.errors.ciclo_plano.message as string}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="prompt-cliente" className="text-xs font-semibold tracking-wider text-slate-500">PROMPT DO CLIENTE</Label>
                          <Textarea
                            id="prompt-cliente"
                            placeholder="Digite o prompt do cliente"
                            {...registerForm.register('prompt_cliente')}
                            className={`min-h-[140px] rounded-xl bg-slate-50 border-slate-200 focus:border-primary focus:ring-primary/20 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-colors ${registerForm.formState.errors.prompt_cliente ? 'border-red-500' : ''}`}
                          />
                          {registerForm.formState.errors.prompt_cliente && (
                            <p className="text-sm text-red-600">{registerForm.formState.errors.prompt_cliente.message}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <Button
                            type="button"
                            className="w-full h-14 rounded-2xl bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 shadow-sm transition-all duration-200 active:scale-[0.99] active:translate-y-px"
                            onClick={() => setRegisterStep(1)}
                          >
                            Voltar
                          </Button>

                          <Button
                            type="submit"
                            className="w-full h-14 rounded-2xl bg-black hover:bg-black/90 active:bg-black text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.99] active:translate-y-px"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Criando conta...
                              </div>
                            ) : (
                              <>
                                <span>Finalizar Cadastro</span>
                                <ArrowRight className="h-5 w-5 ml-2" />
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    )}

                  </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {isProgressOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10">
            <div className="text-lg font-semibold text-slate-900">Finalizando Cadastro</div>
            <div className="mt-1 text-sm text-slate-600">{progressStatus}</div>

            <div className="mt-4 h-3 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-black transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500">{progressPercent}%</div>

            {progressError && (
              <div className="mt-3 text-sm text-red-600">{progressError}</div>
            )}

            {progressError && (
              <Button
                type="button"
                className="mt-5 w-full h-12 rounded-xl bg-black hover:bg-black/90 active:bg-black text-white font-semibold"
                onClick={() => setIsProgressOpen(false)}
              >
                Fechar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Registrar;
