import React from 'react';
import { useCRM } from '@/contexts/CRMContext';
import WhatsAppConectar from './whatsapp/WhatsAppConectar';
import ApiOficialAtivacao from './whatsapp/ApiOficialAtivacao';
import ApiOficialPerfil from './whatsapp/ApiOficialPerfil';

/**
 * Aba "WhatsApp" das Configurações. Três telas conforme a conta:
 * - API Oficial ainda não ativa, mas recomendada: fluxo de criação/integração;
 * - API Oficial ativa: perfil comercial exibido no WhatsApp;
 * - demais contas: conexão por QR Code ou código (UAZAPI).
 *
 * Cada tela tem a sua lógica em `whatsapp/` (useWhatsAppConexao e useApiOficial).
 */
export const WhatsAppTab: React.FC = () => {
  const { user } = useCRM();

  if (user?.api_oficial !== true && user?.recomendar_api_oficial === true) return <ApiOficialAtivacao />;
  if (user?.api_oficial === true) return <ApiOficialPerfil />;
  return <WhatsAppConectar />;
};

export default WhatsAppTab;
