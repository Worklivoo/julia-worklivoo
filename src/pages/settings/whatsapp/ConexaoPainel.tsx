import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, QrCode, RefreshCw } from 'lucide-react';
import type { WhatsAppConexaoCtx } from './useWhatsAppConexao';

/** Estado atual da conexão: carregando, conectado, erro, QR Code ou código de pareamento. */
const ConexaoPainel = ({ c }: { c: WhatsAppConexaoCtx }) => {
  const emCooldown = c.cooldownTimer > 0;

  if (c.isLoading) {
    return (
      <div className="wl-wa__panel" role="status">
        <span className="wl-spin wl-spin--lg" aria-hidden="true" />
        <p className="wl-wa__meta">{c.connectionMethod === 'qrcode' ? 'Gerando QR Code...' : 'Gerando código...'}</p>
      </div>
    );
  }

  if (c.isConnected) {
    return (
      <div className="wl-wa__panel">
        <div className="wl-wa__avatar">
          {c.connectedInfo?.profilePicUrl ? (
            <img src={c.connectedInfo.profilePicUrl} alt="Foto do perfil" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
        </div>
        <div>
          <p className="wl-wa__big">Conectado com sucesso</p>
          {c.connectedInfo?.name && <p className="wl-wa__meta" style={{ color: 'var(--ink)', fontWeight: 700, marginTop: 8 }}>{c.connectedInfo.name}</p>}
          {c.connectedInfo?.owner && <p className="wl-wa__meta" style={{ marginTop: 2 }}>{c.connectedInfo.owner.replace(/^55/, '')}</p>}
          {c.connectedCity?.label && (
            <p className="wl-wa__meta" style={{ marginTop: 2 }}>
              {c.connectedCity.label}
              {c.connectedCity.state ? ` - ${String(c.connectedCity.state).toUpperCase()}` : ''}
            </p>
          )}
        </div>
        <button type="button" className="wl-btn wl-btn--danger wl-btn--sm" onClick={c.disconnectWhatsApp} disabled={c.isLoading}>
          Desconectar
        </button>
      </div>
    );
  }

  if (c.error) {
    return (
      <div className="wl-wa__panel">
        <span className="wl-wa-state__icon"><AlertTriangle aria-hidden="true" /></span>
        <p className="wl-wa__err" role="alert">{c.error}</p>
        <button type="button" className="wl-btn wl-btn--lime wl-btn--sm" onClick={c.handleRetry} disabled={emCooldown}>
          <RefreshCw aria-hidden="true" width={14} height={14} />
          {emCooldown ? `Aguarde ${c.cooldownTimer}s` : 'Tentar novamente'}
        </button>
      </div>
    );
  }

  if (c.connectionMethod === 'qrcode') {
    return (
      <div className="wl-wa__panel">
        <div className="wl-wa__qr">
          {c.qrCode ? <img src={c.qrCode} alt="QR Code para conectar o WhatsApp" /> : <QrCode aria-hidden="true" />}
        </div>

        {c.qrCode ? (
          <span className="wl-tag wl-tag--won"><Clock aria-hidden="true" />Expira em {c.qrCodeTimer}s</span>
        ) : (
          <span className="wl-tag wl-tag--idle">Aguardando geração...</span>
        )}

        <button type="button" className="wl-btn wl-btn--lime" onClick={c.handleConnect} disabled={emCooldown}>
          <RefreshCw aria-hidden="true" width={16} height={16} />
          {emCooldown ? `Aguarde ${c.cooldownTimer}s` : 'Gerar novo código'}
        </button>
      </div>
    );
  }

  if (c.phoneCode) {
    return (
      <div className="wl-wa__panel">
        <div className="wl-wa__codebox">
          <p className="wl-wa__meta">Seu código de conexão</p>
          <div className="wl-wa__code">{c.phoneCode}</div>
          <span className="wl-tag wl-tag--won"><Clock aria-hidden="true" />Expira em {c.qrCodeTimer}s</span>
          <p className="wl-wa__hint">Digite este código no seu WhatsApp</p>
          <button type="button" className="wl-btn wl-btn--lime" onClick={c.handleConnect} disabled={emCooldown}>
            <RefreshCw aria-hidden="true" width={16} height={16} />
            {emCooldown ? `Aguarde ${c.cooldownTimer}s` : 'Obter código'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wl-wa__panel">
      <div className="wl-wa__fieldbox">
        <div className="wl-field">
          <label className="wl-label" htmlFor="wa-telefone">Número de WhatsApp</label>
          <div className="wl-phone">
            <span className="wl-phone__ddi">+55</span>
            <input
              id="wa-telefone"
              className="wl-input"
              type="tel"
              inputMode="numeric"
              value={c.phoneNumber}
              onChange={(e) => c.setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="11999999999"
              maxLength={11}
            />
          </div>
          <p className="wl-wa__hint">DDD + Número (Ex: 11999999999)</p>
        </div>
        <button
          type="button"
          className="wl-btn wl-btn--lime wl-btn--block"
          onClick={c.handleConnect}
          disabled={!c.phoneNumber || c.phoneNumber.length < 10 || emCooldown}
        >
          {emCooldown ? `Aguarde ${c.cooldownTimer}s` : 'Obter código'}
        </button>
      </div>
    </div>
  );
};

export default ConexaoPainel;
