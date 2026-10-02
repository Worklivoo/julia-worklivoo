import React from 'react';
import { History } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { GeraisCtx } from './useGerais';
import GeraisCard, { EditButton } from './GeraisCard';
import StatusTag from './StatusTag';

/** Aviso à equipe depois que a IA esgota as tentativas de FollowUp: status, etapas e método de aviso. */
const TransbordoCard = ({ g }: { g: GeraisCtx }) => (
  <GeraisCard
    id="ger-transbordo"
    icon={<History aria-hidden="true" />}
    title="Transbordo de FollowUp"
    sub="Quando ativado, após a IA realizar todas as tentativas de FollowUp, a equipe será notificada para ficar ciente de que o cliente não deu continuidade no atendimento."
  >
    <div className="wl-subgrid">
      <div className="wl-set-box">
        <div className="wl-row">
          <div className="wl-kv">
            <span className="wl-label">Status do transbordo</span>
            <StatusTag on={g.transbordoAtivado} loading={g.loadingTransbordoStatus} />
          </div>
          <Switch
            checked={g.transbordoAtivado}
            onCheckedChange={g.handleToggleTransbordoStatus}
            disabled={g.loadingTransbordoStatus || g.isSavingTransbordoStatus}
            aria-label="Transbordo de FollowUp"
            className="data-[state=checked]:bg-[var(--ink)]"
          />
        </div>
      </div>

      <div className="wl-set-box">
        <div className="wl-row" style={{ alignItems: 'flex-start' }}>
          <div className="wl-kv">
            <span className="wl-label">Etapas do Lead</span>
            <div className="wl-pillrow">
              {g.loadingTransbordoEtapas ? (
                <span className="wl-tag wl-tag--plain">Carregando...</span>
              ) : g.transbordoEtapasSelecionadas.length > 0 ? (
                g.transbordoEtapasSelecionadas.map((etapa) => (
                  <span key={etapa} className="wl-tag wl-tag--plain">{etapa}</span>
                ))
              ) : (
                <span className="wl-tag wl-tag--plain">Nenhuma etapa selecionada</span>
              )}
            </div>
          </div>
          <EditButton onClick={() => g.setTransbordoEtapasOpen(true)} disabled={g.loadingTransbordoEtapas} />
        </div>
      </div>

      <div className="wl-set-box is-span">
        <div className="wl-row" style={{ alignItems: 'flex-start' }}>
          <div className="wl-kv">
            <span className="wl-label">Método de aviso</span>
            <div className="wl-pillrow">
              <span className="wl-tag wl-tag--plain">
                {g.loadingTransbordoMetodoConfig ? 'Carregando...' : g.transbordoMetodoAviso === 'whatsapp' ? 'WhatsApp' : 'Roleta'}
              </span>
              {g.transbordoTelefones.length > 0 ? (
                g.transbordoTelefones.map((phone) => (
                  <span key={phone} className="wl-tag wl-tag--plain">{phone}</span>
                ))
              ) : (
                <span className="wl-tag wl-tag--plain">Nenhum número cadastrado</span>
              )}
            </div>
          </div>
          <EditButton onClick={() => g.setTransbordoMetodoAvisoOpen(true)} disabled={g.loadingTransbordoMetodoConfig} />
        </div>
      </div>
    </div>
  </GeraisCard>
);

export default TransbordoCard;
