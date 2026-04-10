import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useCRM } from '@/contexts/CRMContext';

import './Sidebar.css';
import { 
  Home, 
  MessageSquare,
  Settings, 
  ChevronLeft, 
  Menu, 
  X,
  Sun,
  Moon,
  LogOut,
  Contact,
  Sparkles,
  CreditCard,
  Gift
} from 'lucide-react';

interface NavigationItem {
  name: string;
  path: string;
  icon: React.ComponentType<any>;
  tooltip: string;
  highlight?: boolean;
}

const Sidebar = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useCRM();
  
  // Recuperar estado do sidebar do localStorage na inicialização
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    return savedState ? JSON.parse(savedState) : false;
  });
  const [isMenuActive, setIsMenuActive] = useState(false);

  // Navegação principal do CRM
  const primaryNavigation = [
    {
      name: 'Inicio',
      path: '/inicio',
      icon: Home,
      tooltip: 'Inicio'
    },
    {
      name: 'Leads',
      path: '/leads',
      icon: Contact,
      tooltip: 'Funil de Leads'
    },
    {
      name: 'Conversas',
      path: '/conversas',
      icon: MessageSquare,
      tooltip: 'Conversas'
    },
    {
      name: 'Try-Out',
      path: '/try-out',
      icon: Sparkles,
      tooltip: 'Try-Out'
    },
    {
      name: 'Assinatura',
      path: '/assinatura',
      icon: CreditCard,
      tooltip: 'Assinatura'
    },
    {
      name: 'Indique e Ganhe',
      path: '/indique-ganhe',
      icon: Gift,
      tooltip: 'Indique e Ganhe',
      highlight: true
    },
    {
      name: 'Configurações',
      path: '/configuracoes',
      icon: Settings,
      tooltip: 'Configurações'
    }
  ];

  // Função para verificar se o link está ativo
  const isActiveLink = (path: string) => {
    return location.pathname === path;
  };

  // Função para alternar o sidebar
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    // Salvar estado no localStorage
    localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
  };

  // Função para alternar o menu mobile
  const toggleMenu = () => {
    setIsMenuActive(!isMenuActive);
  };

  // Ajustar altura do sidebar em mobile
  useEffect(() => {
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    if (sidebar) {
      if (window.innerWidth < 1024) {
        sidebar.style.height = isMenuActive ? `${sidebar.scrollHeight}px` : '56px';
      } else {
        sidebar.style.height = 'calc(100vh - 32px)';
      }
    }
  }, [isMenuActive]);

  // Ajustar sidebar no resize da janela
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMenuActive(false);
        const sidebar = document.querySelector('.sidebar') as HTMLElement;
        if (sidebar) {
          sidebar.style.height = 'calc(100vh - 32px)';
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMenuActive ? 'menu-active' : ''}`}>
      {/* Header do Sidebar */}
      <header className="sidebar-header">
        <div className="sidebar-logo">
          <img 
            src="/logo-worklivoo-fundo-preto.png" 
            alt="Worklivoo" 
            className="logo-image logo-rounded"
          />
        </div>
        <button className="toggler sidebar-toggler" onClick={toggleSidebar}>
          <ChevronLeft className="material-symbols-rounded" />
        </button>
        <button className="toggler menu-toggler" onClick={toggleMenu}>
          {isMenuActive ? <X className="material-symbols-rounded" /> : <Menu className="material-symbols-rounded" />}
        </button>
      </header>

      {/* Navegação do Sidebar */}
      <nav className="sidebar-nav">
        {/* Navegação Principal */}
        <ul className="nav-list primary-nav">
          {primaryNavigation.map((item) => {
            const IconComponent = item.icon;
            return (
              <li key={item.name} className="nav-item">
                <Link
                  to={item.path}
                  className={`nav-link ${isActiveLink(item.path) ? 'active' : ''}`}
                >
                  <div className="relative flex items-center justify-center">
                    <IconComponent className="nav-icon material-symbols-rounded" />
                    {item.highlight && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                    )}
                  </div>
                  <span className="nav-label">{item.name}</span>
                </Link>
                <span className="nav-tooltip">{item.tooltip}</span>
              </li>
            );
          })}
        </ul>

        {/* Navegação Secundária */}
        <ul className="nav-list secondary-nav">
          {/* Toggle de Tema */}
          <li className="nav-item">
            <button 
              className="nav-link theme-toggle" 
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {theme === 'dark' ? (
                <Sun className="nav-icon material-symbols-rounded" />
              ) : (
                <Moon className="nav-icon material-symbols-rounded" />
              )}
              <span className="nav-label">
                {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              </span>
            </button>
            <span className="nav-tooltip">
              {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            </span>
          </li>

          {/* Logout */}
          <li className="nav-item">
            <button className="nav-link logout-button" onClick={logout}>
              <LogOut className="nav-icon material-symbols-rounded" />
              <span className="nav-label">Sair</span>
            </button>
            <span className="nav-tooltip">Sair</span>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
