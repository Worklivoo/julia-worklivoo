import { useParams, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';


const ClientPage = () => {
  const { clientUrl } = useParams<{ clientUrl: string }>();
  const [client, setClient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // URLs reservadas do sistema que não devem ser tratadas como clientUrl
  const reservedUrls = ['404', 'auth', 'inicio', 'leads', 'lead', 'whatsapp', 'configuracoes', 'reset-password', 'base-de-conhecimento'];

  useEffect(() => {
    const loadClient = async () => {
      if (!clientUrl || reservedUrls.includes(clientUrl)) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Funcionalidade de cliente removida
      setNotFound(true);
      setLoading(false);
    };

    loadClient();
  }, [clientUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-6">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg 
                className="w-8 h-8 text-destructive" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              A sua página infelizmente não foi encontrada!
            </h1>
            <p className="text-muted-foreground mb-6">
              O cliente solicitado não foi encontrado ou não está ativo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg 
              className="w-8 h-8 text-primary" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6" 
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {client.nome}
          </h1>
          <p className="text-muted-foreground mb-6">
            Página em desenvolvimento
          </p>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-6 border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Em breve
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta página está ativa e será desenvolvida em breve. 
            Estamos preparando uma experiência incrível para você!
          </p>
        </div>
        
        <div className="mt-6 text-xs text-muted-foreground">
          URL: /{client.url}
        </div>
      </div>
    </div>
  );
};

export default ClientPage;