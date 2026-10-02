import { Link } from 'react-router-dom';
import { ArrowRight, FileQuestion } from 'lucide-react';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-auth.css';

const NotFound = () => {
  return (
    <div className="wl-scope wl-auth">
      <main className="wl-card wl-notfound">
        <span className="wl-modal__icon"><FileQuestion aria-hidden="true" /></span>
        <p className="wl-eyebrow">Erro 404</p>
        <h1 className="wl-title">Página não encontrada</h1>
        <p className="wl-lede">
          A página que você está procurando não existe, foi movida ou o cliente pode estar inativo.
        </p>
        <Link to="/inicio" className="wl-btn wl-btn--lime wl-btn--block">
          Voltar para o Painel
          <ArrowRight className="wl-btn__arrow" aria-hidden="true" />
        </Link>
      </main>

      <p className="wl-foot">© {new Date().getFullYear()} Worklivoo. Todos os direitos reservados.</p>
    </div>
  );
};

export default NotFound;
