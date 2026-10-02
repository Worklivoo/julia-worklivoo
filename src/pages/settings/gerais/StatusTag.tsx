import React from 'react';

/** Etiqueta de status Ativado/Desativado usada nos cartões da aba Gerais. */
const StatusTag = ({ on, loading }: { on: boolean; loading?: boolean }) => (
  <span className={`wl-tag ${on ? 'wl-tag--won' : 'wl-tag--plain'}`}>
    {loading ? 'Carregando...' : on ? 'Ativado' : 'Desativado'}
  </span>
);

export default StatusTag;
