import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useCRM();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/inicio');
    } else {
      navigate('/auth');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-primary light-title">CRM Pro</h1>
        <p className="text-xl text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
};

export default Index;
