import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Mail, Lock, User, Phone, Building, DollarSign } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormData } from '@/schemas/auth';
import { DEFAULT_PROMPTS } from '@/constants/prompts';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-auth.css';

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

  const inputClass = (hasError: boolean, extra = '') =>
    `wl-input ${extra} ${hasError ? 'is-invalid' : ''}`.replace(/\s+/g, ' ').trim();

  const errors = registerForm.formState.errors;

  return (
    <div className="wl-scope wl-auth">
      <main className={`wl-card ${isAuthVerified ? 'wl-card--wide' : ''}`}>
        <img src="/logo-worklivoo-fundo-preto.png" alt="Worklivoo" className="wl-brand" />

        {!isAuthVerified ? (
          <>
            <header className="wl-head">
              <p className="wl-eyebrow">Acesso interno</p>
              <h1 className="wl-title">Área restrita</h1>
              <p className="wl-lede">Digite a chave de acesso para continuar.</p>
            </header>

            <form onSubmit={handleVerifyAuth} className="wl-form">
              <div className="wl-field">
                <label htmlFor="auth-gate-password" className="wl-label">Chave de acesso</label>
                <div className="wl-control">
                  <Lock className="wl-control__icon" aria-hidden="true" />
                  <input
                    id="auth-gate-password"
                    type="password"
                    placeholder="Senha de acesso"
                    value={authPasswordInput}
                    onChange={(e) => setAuthPasswordInput(e.target.value)}
                    className="wl-input wl-input--icon"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" className="wl-btn wl-btn--lime wl-btn--block">
                Acessar painel
                <ArrowRight className="wl-btn__arrow" aria-hidden="true" />
              </button>
            </form>

            <p className="wl-rule">
              Protegido por criptografia de ponta a ponta.
              <br />
              Julia Worklivoo
            </p>
          </>
        ) : (
          <>
            <div className="wl-steps" role="img" aria-label={`Etapa ${registerStep} de 2`}>
              <span className="wl-steps__bar is-on" />
              <span className={`wl-steps__bar ${registerStep === 2 ? 'is-on' : ''}`} />
            </div>

            <header className="wl-head">
              <p className="wl-eyebrow">Etapa {registerStep} de 2</p>
              <h1 className="wl-title">Cadastro de cliente</h1>
              <p className="wl-lede">
                {registerStep === 1
                  ? 'Preencha os dados abaixo para criar a conta.'
                  : 'Defina o plano e revise o prompt do cliente.'}
              </p>
            </header>

            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="wl-form">
              {registerStep === 1 ? (
                <>
                  <div className="wl-field">
                    <label htmlFor="name" className="wl-label">Nome completo</label>
                    <div className="wl-control">
                      <User className="wl-control__icon" aria-hidden="true" />
                      <input
                        id="name"
                        type="text"
                        placeholder="Seu nome completo"
                        {...registerForm.register('name')}
                        required
                        className={inputClass(!!errors.name, 'wl-input--icon')}
                      />
                    </div>
                    {errors.name && <p className="wl-error">{errors.name.message}</p>}
                  </div>

                  <div className="wl-grid">
                    <div className="wl-field">
                      <label htmlFor="register-email" className="wl-label">E-mail</label>
                      <div className="wl-control">
                        <Mail className="wl-control__icon" aria-hidden="true" />
                        <input
                          id="register-email"
                          type="email"
                          placeholder="seu@email.com"
                          {...registerForm.register('email')}
                          required
                          className={inputClass(!!errors.email, 'wl-input--icon')}
                        />
                      </div>
                      {errors.email && <p className="wl-error">{errors.email.message}</p>}
                    </div>

                    <div className="wl-field">
                      <label htmlFor="phone" className="wl-label">Telefone</label>
                      <div className="wl-control">
                        <Phone className="wl-control__icon" aria-hidden="true" />
                        <span className="wl-control__prefix">55</span>
                        <input
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
                          className={inputClass(!!errors.telefone, 'wl-input--prefix')}
                        />
                      </div>
                      {errors.telefone && <p className="wl-error">{errors.telefone.message}</p>}
                    </div>
                  </div>

                  <div className="wl-grid">
                    <div className="wl-field">
                      <label htmlFor="company" className="wl-label">Nome da empresa</label>
                      <div className="wl-control">
                        <Building className="wl-control__icon" aria-hidden="true" />
                        <input
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
                          className={inputClass(!!errors.empresa, 'wl-input--icon')}
                        />
                      </div>
                      {errors.empresa && <p className="wl-error">{errors.empresa.message}</p>}
                    </div>

                    <div className="wl-field">
                      <label htmlFor="user-tipo" className="wl-label">Tipo de cliente</label>
                      <Select value={registerForm.watch('user_tipo')} onValueChange={(v) => registerForm.setValue('user_tipo', v as RegisterFormData['user_tipo'], { shouldDirty: true, shouldValidate: true })}>
                        <SelectTrigger id="user-tipo" className={inputClass(!!errors.user_tipo)}>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent className="wl-scope wl-menu">
                          <SelectItem value="Loja de Carros" className="wl-menu__item">Loja de Carros</SelectItem>
                          <SelectItem value="Imobiliaria" className="wl-menu__item">Imobiliaria</SelectItem>
                          <SelectItem value="Outros" className="wl-menu__item">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.user_tipo && <p className="wl-error">{errors.user_tipo.message as string}</p>}
                    </div>
                  </div>

                  <div className="wl-field">
                    <label htmlFor="whatsapp-group-link" className="wl-label">ID do grupo do WhatsApp</label>
                    <div className="wl-input-row">
                      <input
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
                        className={inputClass(!!whatsappGroupValidationError)}
                      />
                      <button
                        type="button"
                        className="wl-btn wl-btn--glass-ink"
                        onClick={validateWhatsappGroupLink}
                        disabled={isWhatsappGroupValidating}
                      >
                        {isWhatsappGroupValidating ? 'Validando...' : isWhatsappGroupValidated ? 'Validado' : 'Validar'}
                      </button>
                    </div>
                    {whatsappGroupValidationError && <p className="wl-error">{whatsappGroupValidationError}</p>}
                    {!whatsappGroupValidationError && whatsappGroupValidationSuccess && (
                      <p className="wl-hint">{whatsappGroupValidationSuccess}</p>
                    )}
                  </div>

                  <div className="wl-grid">
                    <div className="wl-field">
                      <label htmlFor="leads-volume" className="wl-label">Volume de leads/mês</label>
                      <input
                        id="leads-volume"
                        type="number"
                        min={1}
                        placeholder="Ex.: 100"
                        {...registerForm.register('leads_volume', { valueAsNumber: true })}
                        required
                        className={inputClass(!!errors.leads_volume)}
                      />
                      {errors.leads_volume && <p className="wl-error">{errors.leads_volume.message as string}</p>}
                    </div>

                    <div className="wl-field">
                      <label htmlFor="valor-plano" className="wl-label">Valor do plano</label>
                      <div className="wl-control">
                        <DollarSign className="wl-control__icon" aria-hidden="true" />
                        <input
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
                          className={inputClass(!!errors.valor_plano, 'wl-input--icon')}
                        />
                      </div>
                      {errors.valor_plano && <p className="wl-error">{errors.valor_plano.message as string}</p>}
                    </div>
                  </div>

                  <div className="wl-field">
                    <label htmlFor="register-password" className="wl-label">Senha de acesso</label>
                    <div className="wl-control">
                      <Lock className="wl-control__icon" aria-hidden="true" />
                      <input
                        id="register-password"
                        type={showRegisterPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Crie uma senha segura"
                        {...registerForm.register('password')}
                        required
                        className={inputClass(!!errors.password, 'wl-input--icon wl-input--action')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        className="wl-control__action"
                        aria-label={showRegisterPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showRegisterPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      </button>
                    </div>
                    {errors.password && <p className="wl-error">{errors.password.message}</p>}
                  </div>

                  <button type="button" className="wl-btn wl-btn--lime wl-btn--block" onClick={handleAdvanceStep}>
                    Avançar
                    <ArrowRight className="wl-btn__arrow" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <>
                  <div className="wl-grid">
                    <div className="wl-field">
                      <label htmlFor="plano-usuario" className="wl-label">Plano do usuário</label>
                      <Select
                        value={registerForm.watch('plano_usuario')}
                        onValueChange={(v) => registerForm.setValue('plano_usuario', v as RegisterFormData['plano_usuario'])}
                      >
                        <SelectTrigger id="plano-usuario" className={inputClass(!!errors.plano_usuario)}>
                          <SelectValue placeholder="Selecione o plano" />
                        </SelectTrigger>
                        <SelectContent className="wl-scope wl-menu">
                          <SelectItem value="Growth" className="wl-menu__item">Growth</SelectItem>
                          <SelectItem value="Essencial" className="wl-menu__item">Essencial</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.plano_usuario && <p className="wl-error">{errors.plano_usuario.message as string}</p>}
                    </div>

                    <div className="wl-field">
                      <label htmlFor="ciclo-plano" className="wl-label">Ciclo do plano</label>
                      <Select
                        value={registerForm.watch('ciclo_plano')}
                        onValueChange={(v) => registerForm.setValue('ciclo_plano', v as RegisterFormData['ciclo_plano'])}
                      >
                        <SelectTrigger id="ciclo-plano" className={inputClass(!!errors.ciclo_plano)}>
                          <SelectValue placeholder="Selecione o ciclo" />
                        </SelectTrigger>
                        <SelectContent className="wl-scope wl-menu">
                          <SelectItem value="Mensal" className="wl-menu__item">Mensal</SelectItem>
                          <SelectItem value="Trimestral" className="wl-menu__item">Trimestral</SelectItem>
                          <SelectItem value="Anual" className="wl-menu__item">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.ciclo_plano && <p className="wl-error">{errors.ciclo_plano.message as string}</p>}
                    </div>
                  </div>

                  <div className="wl-field">
                    <label htmlFor="prompt-cliente" className="wl-label">Prompt do cliente</label>
                    <textarea
                      id="prompt-cliente"
                      placeholder="Digite o prompt do cliente"
                      {...registerForm.register('prompt_cliente')}
                      className={inputClass(!!errors.prompt_cliente)}
                    />
                    {errors.prompt_cliente && <p className="wl-error">{errors.prompt_cliente.message}</p>}
                  </div>

                  <div className="wl-btn-row">
                    <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => setRegisterStep(1)}>
                      Voltar
                    </button>

                    <button type="submit" className="wl-btn wl-btn--lime" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <span className="wl-spinner" aria-hidden="true" />
                          Criando conta...
                        </>
                      ) : (
                        <>
                          Finalizar cadastro
                          <ArrowRight className="wl-btn__arrow" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </>
        )}
      </main>

      {isProgressOpen && (
        <div className="wl-scope wl-progress" role="dialog" aria-modal="true" aria-label="Finalizando cadastro">
          <div className="wl-progress__card">
            <h2 className="wl-title wl-title--sm">Finalizando cadastro</h2>
            <p className="wl-lede">{progressStatus}</p>

            <div className="wl-progress__track">
              <div className="wl-progress__fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="wl-progress__pct">{progressPercent}%</div>

            {progressError && <p className="wl-alert wl-progress__gap" role="alert">{progressError}</p>}

            {progressError && (
              <button
                type="button"
                className="wl-btn wl-btn--lime wl-btn--block wl-progress__gap"
                onClick={() => setIsProgressOpen(false)}
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Registrar;
