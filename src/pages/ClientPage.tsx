import NotFound from '@/pages/NotFound';

/**
 * Rota `/:clientUrl`. A funcionalidade de página por cliente foi removida, então qualquer
 * endereço que não seja uma rota do painel cai na página "não encontrada".
 */
const ClientPage = () => <NotFound />;

export default ClientPage;
