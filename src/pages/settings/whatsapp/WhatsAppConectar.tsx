import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useWhatsAppConexao } from './useWhatsAppConexao';
import ConexaoPainel from './ConexaoPainel';
import CidadeDialog from './CidadeDialog';
import { SegmentedChoice } from '../gerais/GeraisDialog';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-lead.css';
import '@/styles/worklivoo-settings.css';

const passos = [
  { titulo: 'Abra o WhatsApp', texto: 'Abra o aplicativo no seu celular.' },
  { titulo: 'Acesse o menu', texto: 'Toque em Configurações ou no menu de 3 pontos.' },
  { titulo: 'Aparelhos conectados', texto: 'Selecione "Conectar um aparelho" e aponte a câmera.' },
];

/** Conexão do WhatsApp comum: passo a passo à esquerda e, à direita, QR Code ou código de pareamento. */
const WhatsAppConectar = () => {
  const c = useWhatsAppConexao();

  return (
    <div className="wl-tabpane">
      <div className="wl-tabhead">
        <div>
          <h3 className="wl-section__title">Conectar WhatsApp</h3>
          <p className="wl-lede">Escaneie o QR Code para conectar seu número e ativar o agente.</p>
        </div>
      </div>

      <div className="wl-wa">
        <section className="wl-set-card" aria-labelledby="wa-como">
          <h3 id="wa-como" className="wl-set-card__title">Como conectar</h3>
          <ol className="wl-wa__steps">
            {passos.map((passo, idx) => (
              <li key={passo.titulo} className="wl-wa__step">
                <span className="wl-wa__n">{idx + 1}</span>
                <div>
                  <h4>{passo.titulo}</h4>
                  <p>{passo.texto}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="wl-wa__note">
            <AlertCircle aria-hidden="true" />
            Se por algum motivo você não estiver conseguindo conectar por QR Code, selecione a opção por Código.
          </p>
        </section>

        <section className="wl-set-card" aria-label="Conexão">
          {!c.isConnected && (
            <SegmentedChoice<'qrcode' | 'phone'>
              label="Método de conexão"
              value={c.connectionMethod}
              onChange={c.setConnectionMethod}
              options={[
                { value: 'qrcode', label: 'QR Code' },
                { value: 'phone', label: 'Código' },
              ]}
            />
          )}
          <ConexaoPainel c={c} />
        </section>
      </div>

      <CidadeDialog c={c} />
    </div>
  );
};

export default WhatsAppConectar;
