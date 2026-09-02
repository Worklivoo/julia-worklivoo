import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useCRM } from '@/contexts/CRMContext';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '@/schemas/auth';
import { AlertDialog, AlertDialogContent, AlertDialogFooter } from '@/components/ui/alert-dialog';
import termosDeUsoTexto from '@/terms/termos-de-uso.txt?raw';

const escapeHtml = (value: string) =>
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
      setLoginError(result.error || 'Falha ao entrar. Verifique suas credenciais.');
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

      <AlertDialog open={showTermsModal} onOpenChange={(open) => console.log('[Terms] onOpenChange modal', { open })}>
        <AlertDialogContent className="w-[95vw] max-w-6xl h-[90vh] max-h-[90vh] flex flex-col">
          <div className="flex-1 overflow-auto rounded-md border bg-background p-6">
            <div className="prose prose-slate prose-sm sm:prose-base max-w-none">
              <div dangerouslySetInnerHTML={{ __html: termosFormatadosHtml }} />
            </div>
          </div>
          {termsError ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{termsError}</p>
            </div>
          ) : null}
          <AlertDialogFooter className="mt-4">
            <Button onClick={handleAcceptTerms} disabled={termsLoading} className="w-full">
              {termsLoading ? 'Salvando...' : 'Aceitar Termos'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showMemberUpdateModal} onOpenChange={(open) => console.log('[MemberUpdate] onOpenChange modal', { open })}>
        <AlertDialogContent className="w-[95vw] max-w-md rounded-[28px] border border-black/10 bg-white p-8 shadow-2xl">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EBF57D]">
              <RefreshCw className="h-7 w-7 text-black" />
            </div>
          </div>

          <div className="mt-6 space-y-3 text-center">
            <h2 className="text-2xl font-semibold text-black">Nova Atualização Disponível!</h2>
            <p className="text-sm leading-relaxed text-black/70">
              Preparamos melhorias importantes para sua experiência. Para continuar utilizando a plataforma com total
              segurança e performance, é necessário aplicar a atualização agora.
            </p>
          </div>

          {memberUpdateError ? (
            <div className="mt-6 rounded-xl bg-[#EBF57D] p-4">
              <p className="text-sm text-black">{memberUpdateError}</p>
            </div>
          ) : null}

          <AlertDialogFooter className="mt-8">
            <Button
              onClick={handleConfirmMemberUpdate}
              disabled={memberUpdateLoading}
              className="h-14 w-full rounded-xl bg-black text-base font-semibold text-white shadow-lg hover:bg-zinc-900"
            >
              {memberUpdateLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Atualizando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  <RefreshCw className="h-5 w-5" />
                  Atualizar Agora
                </span>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Auth;
