import React from 'react';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

/** Ícone do WhatsApp (MUI) no tamanho dos ícones do lucide, usado no menu de abas e nos cartões. */
const WhatsAppLogo = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <WhatsAppIcon sx={{ width: size + 2, height: size + 2, display: 'block' }} className={className} />
);

export default WhatsAppLogo;
