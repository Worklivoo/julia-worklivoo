import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '@/schemas/auth';
import { AlertDialog, AlertDialogContent, AlertDialogFooter } from '@/components/ui/alert-dialog';
import termosDeUsoTexto from '@/terms/termos-de-uso.txt?raw';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-auth.css';

// O Supabase devolve as mensagens de autenticação em inglês; traduz as mais comuns.
const traduzirErroLogin = (message?: string) => {
  const msg = (message || '').toLowerCase();
  if (!msg) return 'Falha ao entrar. Verifique suas credenciais.';
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('email not confirmed')) return 'Seu e-mail ainda não foi confirmado.';
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde um instante e tente novamente.';
  }
  if (msg.includes('user not found')) return 'Usuário não encontrado.';
  if (msg.includes('user is banned')) return 'Este acesso está bloqueado. Fale com o suporte.';
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Falha de conexão. Verifique sua internet e tente novamente.';
  }
  return message as string;
};

const escapeHtml =(value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const splitLetteredList = (value: string) => {
  const firstIndex = value.search(/\([a-z]\)\s/i);
  if (firstIndex === -1) return null;

  const intro = value.slice(0, firstIndex).trim();
  const after = value.slice(firstIndex).trim();
  const rawItems = after.split(/\s*(?=\([a-z]\)\s)/i).filter(Boolean);
  if (rawItems.length < 2) return null;

  const items = rawItems.map((item) => {
    const match = item.match(/^\(([a-z])\)\s*([\s\S]*)$/i);
    if (!match) return escapeHtml(item);
    const letter = match[1];
    const text = match[2].replace(/^\s*;\s*/, "").replace(/\s*;\s*$/, "");
    return `<strong>(${escapeHtml(letter)})</strong> ${escapeHtml(text)}`;
  });

  return { intro, items };
};

const formatTermsTextToHtml = (raw: string) => {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  let html = "";
  let wroteTitle = false;
  let wroteAnyClause = false;

  for (const originalLine of lines) {
    const line = originalLine.trim();
    if (!line) continue;

    const clauseMatch = line.match(/^CLÁUSULA\s+\d+\s+–\s+.+$/i);
    if (clauseMatch) {
      if (wroteAnyClause) html += "<hr />";
      html += `<h2>${escapeHtml(line)}</h2>`;
      wroteAnyClause = true;
      continue;
    }

    if (!wroteTitle) {
      const isPossibleTitle = !line.startsWith("CLÁUSULA") && !/^\d+(\.\d+)+\./.test(line);
      if (isPossibleTitle) {
        html += `<h1>${escapeHtml(line)}</h1>`;
        wroteTitle = true;
        continue;
      }
      wroteTitle = true;
    }

    const numberedMatch = line.match(/^(\d+(?:\.\d+)+\.)\s*(.+)$/);
    if (numberedMatch) {
      const prefix = numberedMatch[1];
      const rest = numberedMatch[2];

      const lettered = splitLetteredList(rest);
      if (lettered) {
        if (lettered.intro) {
          html += `<p><strong>${escapeHtml(prefix)}</strong> ${escapeHtml(lettered.intro)}</p>`;
        } else {
          html += `<p><strong>${escapeHtml(prefix)}</strong></p>`;
        }
        html += `<ul>${lettered.items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
      } else {
        html += `<p><strong>${escapeHtml(prefix)}</strong> ${escapeHtml(rest)}</p>`;
      }
      continue;
    }

    html += `<p>${escapeHtml(line)}</p>`;
  }

  return html;
};

const Auth = () => {
  const [resetEmail, setResetEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [showMemberUpdateModal, setShowMemberUpdateModal] = useState(false);
  const [memberUpdateLoading, setMemberUpdateLoading] = useState(false);
  const [memberUpdateError, setMemberUpdateError] = useState('');
  const [loggedUserId, setLoggedUserId] = useState<string | null>(null);
  const {
    login,
    needsTermsAcceptance,
    termsUserId,
    acceptTerms,
    needsMemberUpdate,
    memberUpdateUserId,
    confirmMemberUpdate,
  } = useCRM();
  const navigate = useNavigate();
  const termosFormatadosHtml = useMemo(() => formatTermsTextToHtml(termosDeUsoTexto), []);

  // Configuração do formulário de login com validação
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  useEffect(() => {
    if (needsTermsAcceptance && termsUserId) {
      console.log('[Terms] needsTermsAcceptance detectado no contexto. Abrindo modal.', { termsUserId });
      setLoggedUserId(termsUserId);
      setTermsError('');
      setShowTermsModal(true);
    }
  }, [needsTermsAcceptance, termsUserId]);

  useEffect(() => {
    if (needsMemberUpdate && memberUpdateUserId) {
      console.log('[MemberUpdate] needsMemberUpdate detectado no contexto. Abrindo modal.', { memberUpdateUserId });
      setLoggedUserId(memberUpdateUserId);
      setMemberUpdateError('');
      setShowMemberUpdateModal(true);
    }
  }, [needsMemberUpdate, memberUpdateUserId]);

  useEffect(() => {
    const rawHash = window.location.hash || '';
    const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
    const hashParams = new URLSearchParams(hash);
    const authError = hashParams.get('error');
    const authErrorCode = hashParams.get('error_code');
    const authErrorDescription = hashParams.get('error_description');

    if (!authError && !authErrorCode && !authErrorDescription) {
      return;
    }

    if (authErrorCode === 'otp_expired') {
      setLoginError('Este link mágico é inválido, já foi usado ou expirou. Gere um novo link para acessar.');
    } else if (authErrorDescription) {
      setLoginError(decodeURIComponent(authErrorDescription.replace(/\+/g, ' ')));
    } else if (authError) {
      setLoginError(`Falha na autenticação: ${authError}.`);
    }

    try {
      const url = new URL(window.location.href);
      url.hash = '';
      window.history.replaceState({}, document.title, url.pathname + url.search);
    } catch {}
  }, []);

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setLoginError('');
    const result = await login(data.email, data.password);
    if (result.success) {
      if (result.termsRequired) {
        const userId = result.userId || termsUserId || null;
        setLoggedUserId(userId);
        setTermsError('');
        setShowTermsModal(true);
        setIsLoading(false);
        return;
      }

      if (result.memberUpdateRequired) {
        const userId = result.userId || memberUpdateUserId || null;
        setLoggedUserId(userId);
        setMemberUpdateError('');
        setShowMemberUpdateModal(true);
        setIsLoading(false);
        return;
      }

      navigate('/inicio');
    } else {
      setLoginError(traduzirErroLogin(result.error));
    }
    setIsLoading(false);
  };

  const handleAcceptTerms = async () => {
    if (!loggedUserId) return;

    setTermsLoading(true);
    setTermsError('');
    console.log('[Terms] Aceitando termos...', { loggedUserId });

    const result = await acceptTerms();
    console.log('[Terms] Resultado acceptTerms()', result);

    if (!result.success) {
      setTermsError(result.error || 'Não foi possível registrar o aceite. Tente novamente.');
      setTermsLoading(false);
      return;
    }

    if (result.memberUpdateRequired) {
      setTermsLoading(false);
      setShowTermsModal(false);
      setMemberUpdateError('');
      setShowMemberUpdateModal(true);
      return;
    }

    setTermsLoading(false);
    setShowTermsModal(false);
    console.log('[Terms] Termos aceitos. Navegando para /inicio.');
    navigate('/inicio');
  };

  const handleConfirmMemberUpdate = async () => {
    if (!loggedUserId) return;

    setMemberUpdateLoading(true);
    setMemberUpdateError('');

    const result = await confirmMemberUpdate();
    if (!result.success) {
      setMemberUpdateError(result.error || 'Não foi possível concluir esta atualização. Tente novamente.');
      setMemberUpdateLoading(false);
      return;
    }

    try {
      await supabase.auth.signOut();
    } catch {}

    try {
      localStorage.clear();
    } catch {}

    try {
      sessionStorage.clear();
    } catch {}

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {}

    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {}

    try {
      const anyIndexedDb = indexedDB as unknown as { databases?: () => Promise<Array<{ name?: string }>> };
      if (typeof anyIndexedDb.databases === 'function') {
        const dbs = await anyIndexedDb.databases();
        await Promise.all(
          dbs
            .map((db) => db?.name)
            .filter(Boolean)
            .map(
              (name) =>
                new Promise<void>((resolve) => {
                  const req = indexedDB.deleteDatabase(String(name));
                  req.onsuccess = () => resolve();
                  req.onerror = () => resolve();
                  req.onblocked = () => resolve();
                })
            )
        );
      }
    } catch {}

    try {
      const cookies = document.cookie ? document.cookie.split(';') : [];
      for (const cookie of cookies) {
        const eqPos = cookie.indexOf('=');
        const name = (eqPos > -1 ? cookie.slice(0, eqPos) : cookie).trim();
        if (name) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }
      }
    } catch {}

    setMemberUpdateLoading(false);
    setShowMemberUpdateModal(false);
    window.location.replace('/auth');
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
    } catch {
      setResetError('Erro inesperado. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="wl-scope wl-auth">
      <main className="wl-card">
        <img src="/logo-worklivoo-fundo-preto.png" alt="Worklivoo" className="wl-brand" />

        {showForgotPassword ? (
          <>
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setResetMessage('');
                setResetError('');
                setResetEmail('');
              }}
              className="wl-back"
            >
              <ArrowLeft aria-hidden="true" />
              Voltar ao login
            </button>

            <header className="wl-head">
              <h1 className="wl-title">Recuperar senha</h1>
              <p className="wl-lede">Digite seu e-mail para receber o link de recuperação.</p>
            </header>

            <form onSubmit={handleForgotPassword} className="wl-form">
              <div className="wl-field">
                <label htmlFor="reset-email" className="wl-label">E-mail</label>
                <div className="wl-control">
                  <Mail className="wl-control__icon" aria-hidden="true" />
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="wl-input wl-input--icon"
                    required
                  />
                </div>
              </div>

              {resetMessage && <p className="wl-alert wl-alert--ok" role="status">{resetMessage}</p>}
              {resetError && <p className="wl-alert" role="alert">{resetError}</p>}

              <button type="submit" className="wl-btn wl-btn--lime wl-btn--block" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="wl-spinner" aria-hidden="true" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Enviar link de recuperação
                    <ArrowRight className="wl-btn__arrow" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            <header className="wl-head">
              <p className="wl-eyebrow">Painel do cliente</p>
              <h1 className="wl-title">Acesse sua conta</h1>
            </header>

            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="wl-form">
              <div className="wl-field">
                <label htmlFor="email" className="wl-label">E-mail</label>
                <div className="wl-control">
                  <Mail className="wl-control__icon" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    aria-invalid={!!loginForm.formState.errors.email}
                    {...loginForm.register('email')}
                    className={`wl-input wl-input--icon ${loginForm.formState.errors.email ? 'is-invalid' : ''}`}
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="wl-error">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="wl-field">
                <label htmlFor="password" className="wl-label">Senha</label>
                <div className="wl-control">
                  <Lock className="wl-control__icon" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    aria-invalid={!!loginForm.formState.errors.password}
                    {...loginForm.register('password')}
                    className={`wl-input wl-input--icon wl-input--action ${loginForm.formState.errors.password ? 'is-invalid' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="wl-control__action"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="wl-error">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              {loginError && <p className="wl-alert" role="alert">{loginError}</p>}

              <button type="submit" className="wl-btn wl-btn--lime wl-btn--block" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="wl-spinner" aria-hidden="true" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar na conta
                    <ArrowRight className="wl-btn__arrow" aria-hidden="true" />
                  </>
                )}
              </button>

              <div className="wl-center">
                <button type="button" onClick={() => setShowForgotPassword(true)} className="wl-link">
                  Esqueci minha senha
                </button>
              </div>
            </form>
          </>
        )}
      </main>

      <p className="wl-foot">© {new Date().getFullYear()} Worklivoo. Todos os direitos reservados.</p>

      <AlertDialog open={showTermsModal} onOpenChange={(open) => console.log('[Terms] onOpenChange modal', { open })}>
        <AlertDialogContent className="wl-scope wl-modal w-[95vw] max-w-6xl h-[90vh] max-h-[90vh] flex flex-col">
          <div className="wl-terms">
            <div dangerouslySetInnerHTML={{ __html: termosFormatadosHtml }} />
          </div>
          {termsError ? <p className="wl-alert" role="alert">{termsError}</p> : null}
          <AlertDialogFooter className="mt-4">
            <button type="button" onClick={handleAcceptTerms} disabled={termsLoading} className="wl-btn wl-btn--lime wl-btn--block">
              {termsLoading ? (
                <>
                  <span className="wl-spinner" aria-hidden="true" />
                  Salvando...
                </>
              ) : (
                'Aceitar Termos'
              )}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showMemberUpdateModal} onOpenChange={(open) => console.log('[MemberUpdate] onOpenChange modal', { open })}>
        <AlertDialogContent className="wl-scope wl-modal w-[95vw] max-w-md">
          <div className="wl-modal__icon">
            <RefreshCw aria-hidden="true" />
          </div>

          <div className="wl-modal__body">
            <h2 className="wl-title">Nova atualização disponível</h2>
            <p className="wl-lede">
              Preparamos melhorias importantes para sua experiência. Para continuar utilizando a plataforma com total
              segurança e performance, é necessário aplicar a atualização agora.
            </p>
          </div>

          {memberUpdateError ? <p className="wl-alert" role="alert">{memberUpdateError}</p> : null}

          <AlertDialogFooter className="mt-2">
            <button
              type="button"
              onClick={handleConfirmMemberUpdate}
              disabled={memberUpdateLoading}
              className="wl-btn wl-btn--lime wl-btn--block"
            >
              {memberUpdateLoading ? (
                <>
                  <span className="wl-spinner" aria-hidden="true" />
                  Atualizando...
                </>
              ) : (
                <>
                  <RefreshCw aria-hidden="true" width={16} height={16} />
                  Atualizar agora
                </>
              )}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Auth;
