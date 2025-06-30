
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/contexts/CRMContext';
import { User } from 'lucide-react';

const Header = () => {
  const location = useLocation();
  const { user, logout } = useCRM();

  const navigation = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Pipeline', path: '/pipeline' },
    { name: 'Relatórios', path: '/reports' },
  ];

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link to="/dashboard" className="text-2xl font-bold text-primary">
            CRM Pro
          </Link>
          <nav className="flex space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <User size={16} />
            <span>{user?.name}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="border-border hover:bg-accent"
          >
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
