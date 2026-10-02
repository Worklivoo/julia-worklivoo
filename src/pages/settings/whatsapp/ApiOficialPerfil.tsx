import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WhatsAppLogo from '../WhatsAppLogo';
import { useApiOficial } from './useApiOficial';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-settings.css';

const CATEGORIAS: [string, string][] = [
  ['ALCOHOL', 'Bebidas alcoólicas'],
  ['AUTO', 'Automotivo'],
  ['BEAUTY', 'Beleza'],
  ['APPAREL', 'Vestuário'],
  ['EDU', 'Educação'],
  ['ENTERTAIN', 'Entretenimento'],
  ['EVENT_PLAN', 'Eventos'],
  ['FINANCE', 'Finanças'],
  ['GROCERY', 'Mercado'],
  ['GOVT', 'Governo'],
  ['HOTEL', 'Hotelaria'],
  ['HEALTH', 'Saúde'],
  ['NONPROFIT', 'Sem fins lucrativos'],
  ['ONLINE_GAMBLING', 'Apostas online'],
  ['OTC_DRUGS', 'Medicamentos OTC'],
  ['PHYSICAL_GAMBLING', 'Apostas físicas'],
  ['PROF_SERVICES', 'Serviços profissionais'],
  ['RETAIL', 'Varejo'],
  ['TRAVEL', 'Viagens'],
  ['RESTAURANT', 'Restaurante'],
  ['OTHER', 'Outro'],
  ['MATRIMONY_SERVICE', 'Serviço de matrimônio'],
];

const Foto = ({ url }: { url: string }) =>
  url ? <img src={url} alt="Foto do perfil" /> : <i aria-hidden="true" />;

/** Perfil comercial da API Oficial exibido no WhatsApp: leitura e edição (grava na Meta pelo proxy). */
const ApiOficialPerfil = () => {
  const a = useApiOficial();
  const idVazio = !String(a.resolvedApiWhatsappId || '').trim();
  const snap = a.apiOfficialSnapshot;

  return (
    <div className="wl-tabpane">
      <section className="wl-set-card" aria-labelledby="wa-perfil">
        <div className="wl-set-card__head">
          <div className="wl-set-card__id">
            <span className="wl-set-card__icon"><WhatsAppLogo size={16} /></span>
            <div>
              <h3 id="wa-perfil" className="wl-set-card__title">API Oficial do WhatsApp</h3>
              <p className="wl-set-card__sub">Configure as informações do seu perfil exibidas no WhatsApp.</p>
            </div>
          </div>
          {!a.apiOfficialEditMode && (
            <button
              type="button"
              className="wl-btn wl-btn--glass wl-btn--sm"
              onClick={() => a.setApiOfficialEditMode(true)}
              disabled={a.loadingApiOfficialProfile || a.loadingResolvedApiWhatsappId || idVazio || !snap}
            >
              Editar
            </button>
          )}
        </div>

        {a.loadingResolvedApiWhatsappId ? (
          <p className="wl-clist__note">Carregando...</p>
        ) : idVazio ? (
          <p className="wl-set-box wl-kv__value wl-kv__value--text">
            ID da API do WhatsApp não encontrado para este usuário. Preencha a coluna <strong>id_api_whatsapp</strong> na tabela <strong>usuarios_v2</strong>.
          </p>
        ) : a.loadingApiOfficialProfile || !snap ? (
          <p className="wl-clist__note">Carregando...</p>
        ) : a.apiOfficialEditMode ? (
          <>
            <div className="wl-set-box">
              <div className="wl-field">
                <span className="wl-label">Foto</span>
                <div className="wl-profile__photo">
                  <Foto url={a.apiOfficialProfilePictureUrl} />
                  <input
                    className="wl-input"
                    type="file"
                    accept="image/*"
                    aria-label="Nova foto do perfil"
                    onChange={(e) => a.setApiOfficialPhoto(e.target.files?.[0] ?? null)}
                  />
                </div>
                {a.apiOfficialPhoto?.name ? <p className="wl-wa__hint">{a.apiOfficialPhoto.name}</p> : null}
              </div>

              <div className="wl-field">
                <span className="wl-label">Categoria da empresa</span>
                <Select value={a.apiOfficialCategory} onValueChange={a.setApiOfficialCategory}>
                  <SelectTrigger className="wl-input" aria-label="Categoria da empresa">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent className="wl-scope wl-menu">
                    <SelectItem value={a.EMPTY_VERTICAL} className="wl-menu__item">Sem categoria</SelectItem>
                    {CATEGORIAS.map(([value, label]) => (
                      <SelectItem key={value} value={value} className="wl-menu__item">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="wl-field">
                <label className="wl-label" htmlFor="wa-sobre">Sobre (1 a 139)</label>
                <textarea
                  id="wa-sobre"
                  className="wl-input"
                  style={{ minHeight: 90 }}
                  value={a.apiOfficialAbout}
                  onChange={(e) => a.setApiOfficialAbout(e.target.value)}
                  placeholder="Opcional"
                  maxLength={139}
                />
              </div>

              <div className="wl-field">
                <label className="wl-label" htmlFor="wa-descricao">Descrição</label>
                <textarea
                  id="wa-descricao"
                  className="wl-input"
                  style={{ minHeight: 110 }}
                  value={a.apiOfficialDescription}
                  onChange={(e) => a.setApiOfficialDescription(e.target.value)}
                  placeholder="Opcional"
                  maxLength={512}
                />
              </div>

              <div className="wl-grid">
                <div className="wl-field">
                  <label className="wl-label" htmlFor="wa-endereco">Endereço</label>
                  <input
                    id="wa-endereco"
                    className="wl-input"
                    value={a.apiOfficialAddress}
                    onChange={(e) => a.setApiOfficialAddress(e.target.value)}
                    placeholder="Opcional"
                    maxLength={256}
                  />
                </div>
                <div className="wl-field">
                  <label className="wl-label" htmlFor="wa-email">E-mail</label>
                  <input
                    id="wa-email"
                    className="wl-input"
                    type="email"
                    value={a.apiOfficialEmail}
                    onChange={(e) => a.setApiOfficialEmail(e.target.value)}
                    placeholder="Opcional"
                    maxLength={128}
                  />
                </div>
                <div className="wl-field">
                  <label className="wl-label" htmlFor="wa-site1">Site 1</label>
                  <input
                    id="wa-site1"
                    className="wl-input"
                    value={a.apiOfficialWebsite}
                    onChange={(e) => a.setApiOfficialWebsite(e.target.value)}
                    placeholder="https://..."
                    maxLength={256}
                  />
                </div>
                <div className="wl-field">
                  <label className="wl-label" htmlFor="wa-site2">Site 2</label>
                  <input
                    id="wa-site2"
                    className="wl-input"
                    value={a.apiOfficialWebsite2}
                    onChange={(e) => a.setApiOfficialWebsite2(e.target.value)}
                    placeholder="https://..."
                    maxLength={256}
                  />
                </div>
              </div>
            </div>

            <div className="wl-modal__foot wl-modal__foot--end" style={{ marginTop: 0 }}>
              <button type="button" className="wl-btn wl-btn--glass-ink" onClick={a.cancelApiOfficialEdit} disabled={a.savingApiOfficialProfile}>
                Cancelar
              </button>
              <button type="button" className="wl-btn wl-btn--lime" onClick={a.handleSaveApiOfficialProfile} disabled={a.savingApiOfficialProfile}>
                {a.savingApiOfficialProfile ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </>
        ) : (
          <div className="wl-subgrid">
            <div className="wl-set-box">
              <div className="wl-kv">
                <span className="wl-label">Status</span>
                <span><span className="wl-tag wl-tag--won">Conectada</span></span>
              </div>
            </div>
            <div className="wl-set-box">
              <div className="wl-kv">
                <span className="wl-label">Categoria</span>
                <span><span className="wl-tag wl-tag--plain">{a.verticalLabel(snap.vertical ? snap.vertical : a.EMPTY_VERTICAL)}</span></span>
              </div>
            </div>
            <div className="wl-set-box">
              <div className="wl-kv">
                <span className="wl-label">Nome</span>
                <span className="wl-kv__value wl-kv__value--text">{snap.verified_name || '-'}</span>
              </div>
            </div>
            <div className="wl-set-box">
              <div className="wl-kv">
                <span className="wl-label">Número</span>
                <span className="wl-kv__value wl-kv__value--text">{snap.display_phone_number || '-'}</span>
              </div>
            </div>
            <div className="wl-set-box is-span">
              <div className="wl-kv">
                <span className="wl-label">Foto</span>
                <div className="wl-profile__photo">
                  <Foto url={a.apiOfficialProfilePictureUrl} />
                  <span className="wl-wa__hint">{a.apiOfficialProfilePictureUrl ? 'Foto atual' : 'Sem foto configurada'}</span>
                </div>
              </div>
            </div>
            <div className="wl-set-box is-span">
              <div className="wl-kv">
                <span className="wl-label">Sobre</span>
                <span className="wl-kv__value wl-kv__value--text">{snap.about || '-'}</span>
              </div>
            </div>
            <div className="wl-set-box is-span">
              <div className="wl-kv">
                <span className="wl-label">Descrição</span>
                <span className="wl-kv__value wl-kv__value--text">{snap.description || '-'}</span>
              </div>
            </div>
            <div className="wl-set-box">
              <div className="wl-kv">
                <span className="wl-label">Endereço</span>
                <span className="wl-kv__value wl-kv__value--text">{snap.address || '-'}</span>
              </div>
            </div>
            <div className="wl-set-box">
              <div className="wl-kv">
                <span className="wl-label">E-mail</span>
                <span className="wl-kv__value wl-kv__value--text">{snap.email || '-'}</span>
              </div>
            </div>
            <div className="wl-set-box is-span">
              <div className="wl-kv">
                <span className="wl-label">Links</span>
                <span className="wl-kv__value wl-kv__value--text">
                  {[snap.website1, snap.website2].filter(Boolean).join('\n') || '-'}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default ApiOficialPerfil;
