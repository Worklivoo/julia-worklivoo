import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-auth.css';
import '@/styles/worklivoo-settings.css';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isValidSession, setIsValidSession] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Verificar se há uma sessão válida para redefinição de senha
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
      } else {
        // Verificar se há tokens na URL
        const rawHash = window.location.hash || '';
        const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const tokenHash = hashParams.get('token_hash') || searchParams.get('token_hash');
        const otpType = hashParams.get('type') || searchParams.get('type');
        
        if (tokenHash && otpType) {
          if (otpType !== 'recovery') {
            setError('Link de recuperação inválido ou expirado.');
            return;
          }

          const { error } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: tokenHash,
          });

          if (!error) {
            setIsValidSession(true);
            try {
              const url = new URL(window.location.href);
              url.hash = '';
              url.searchParams.delete('token_hash');
              url.searchParams.delete('type');
              url.searchParams.delete('access_token');
              url.searchParams.delete('refresh_token');
              const cleanSearch = url.searchParams.toString();
              const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '');
              window.history.replaceState({}, document.title, cleanUrl);
            } catch {}
          } else {
            setError('Link de recuperação inválido ou expirado.');
          }
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (!error) {
            setIsValidSession(true);
            try {
              const url = new URL(window.location.href);
              url.hash = '';
              url.searchParams.delete('token_hash');
              url.searchParams.delete('type');
              url.searchParams.delete('access_token');
              url.searchParams.delete('refresh_token');
              const cleanSearch = url.searchParams.toString();
              const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '');
              window.history.replaceState({}, document.title, cleanUrl);
            } catch {}
          } else {
            setError('Link de recuperação inválido ou expirado.');
          }
        } else {
          setError('Link de recuperação inválido ou expirado.');
        }
      }
    };

    checkSession();
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError('Erro ao atualizar a senha. Tente novamente.');
      } else {
        setMessage('Senha atualizada com sucesso! Redirecionando...');
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
      }
    } catch {
      setError('Erro inesperado. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValidSession && !error) {
    return (
      <div className="wl-scope wl-auth">
        <main className="wl-card" role="status">
          <div className="wl-reset__wait">
            <span className="wl-spin wl-spin--lg" aria-hidden="true" />
            <p className="wl-lede">Verificando link de recuperação...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="wl-scope wl-auth">
      <main className="wl-card">
        <img src="/logo-worklivoo-fundo-preto.png" alt="Worklivoo" className="wl-brand" />

        <header className="wl-head">
          <h1 className="wl-title">Redefinir senha</h1>
          <p className="wl-lede">Crie uma senha segura para a sua conta.</p>
        </header>

        {error && <p className="wl-alert" role="alert">{error}</p>}
        {message && <p className="wl-alert wl-alert--ok" role="status">{message}</p>}

        {isValidSession && (
          <form onSubmit={handleResetPassword} className="wl-form">
            <div className="wl-field">
              <label htmlFor="password" className="wl-label">Nova senha</label>
              <div className="wl-control">
                <Lock className="wl-control__icon" aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Digite sua nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="wl-input wl-input--icon wl-input--action"
                  required
                  minLength={6}
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
            </div>

            <div className="wl-field">
              <label htmlFor="confirmPassword" className="wl-label">Confirmar nova senha</label>
              <div className="wl-control">
                <Lock className="wl-control__icon" aria-hidden="true" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="wl-input wl-input--icon wl-input--action"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="wl-control__action"
                  aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showConfirmPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button type="submit" className="wl-btn wl-btn--lime wl-btn--block" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="wl-spinner" aria-hidden="true" />
                  Atualizando senha...
                </>
              ) : (
                <>
                  Atualizar senha
                  <ArrowRight className="wl-btn__arrow" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        )}

        {!isValidSession && error && (
          <button type="button" onClick={() => navigate('/auth')} className="wl-btn wl-btn--glass-ink wl-btn--block">
            Voltar ao login
          </button>
        )}
      </main>

      <p className="wl-foot">© {new Date().getFullYear()} Worklivoo. Todos os direitos reservados.</p>
    </div>
  );
};

export default ResetPassword;
