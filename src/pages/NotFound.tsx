import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="mb-6">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <svg 
              className="w-10 h-10 text-muted-foreground" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
          <h2 className="text-xl font-semibold text-foreground mb-4">Página não encontrada</h2>
          <p className="text-muted-foreground mb-8">
            A página que você está procurando não existe, foi movida ou o cliente pode estar inativo.
          </p>
        </div>
        
        <div>
          <Link to="/inicio">
            <Button className="w-full">Voltar para o Painel</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
