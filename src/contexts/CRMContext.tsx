
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Lead, Note, User, DashboardMetrics } from '@/types';

interface CRMContextType {
  leads: Lead[];
  user: User | null;
  isAuthenticated: boolean;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'notes'>) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  addNote: (leadId: string, content: string) => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  getDashboardMetrics: () => DashboardMetrics;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize with sample data
  useEffect(() => {
    const sampleLeads: Lead[] = [
      {
        id: '1',
        opportunityName: 'Software Enterprise - ABC Corp',
        leadName: 'João Silva',
        email: 'joao@abccorp.com',
        phone: '(11) 99999-9999',
        stage: 'qualified',
        status: 'active',
        value: 150000,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-20'),
        source: 'Website',
        priority: 'high',
        expectedCloseDate: new Date('2024-02-15'),
        notes: [
          {
            id: 'n1',
            leadId: '1',
            content: 'Cliente demonstrou interesse no produto Enterprise',
            createdAt: new Date('2024-01-16'),
            author: 'Admin'
          }
        ]
      },
      {
        id: '2',
        opportunityName: 'Consultoria Digital - TechStart',
        leadName: 'Maria Santos',
        email: 'maria@techstart.com',
        phone: '(11) 88888-8888',
        stage: 'proposal',
        status: 'active',
        value: 75000,
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-18'),
        source: 'LinkedIn',
        priority: 'medium',
        expectedCloseDate: new Date('2024-02-10'),
        notes: []
      },
      {
        id: '3',
        opportunityName: 'Sistema CRM - StartupXYZ',
        leadName: 'Pedro Costa',
        email: 'pedro@startupxyz.com',
        phone: '(11) 77777-7777',
        stage: 'negotiation',
        status: 'active',
        value: 200000,
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-22'),
        source: 'Referência',
        priority: 'high',
        expectedCloseDate: new Date('2024-02-01'),
        notes: []
      }
    ];
    setLeads(sampleLeads);
  }, []);

  const addLead = (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'notes'>) => {
    const newLead: Lead = {
      ...leadData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: []
    };
    setLeads(prev => [...prev, newLead]);
  };

  const updateLead = (id: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(lead => 
      lead.id === id 
        ? { ...lead, ...updates, updatedAt: new Date() }
        : lead
    ));
  };

  const deleteLead = (id: string) => {
    setLeads(prev => prev.filter(lead => lead.id !== id));
  };

  const addNote = (leadId: string, content: string) => {
    const newNote: Note = {
      id: Date.now().toString(),
      leadId,
      content,
      createdAt: new Date(),
      author: user?.name || 'Admin'
    };

    setLeads(prev => prev.map(lead => 
      lead.id === leadId 
        ? { ...lead, notes: [...lead.notes, newNote] }
        : lead
    ));
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simulate login
    if (email && password) {
      setUser({ id: '1', name: 'Admin', email });
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    // Simulate registration
    if (name && email && password) {
      setUser({ id: '1', name, email });
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  const getDashboardMetrics = (): DashboardMetrics => {
    const totalLeads = leads.length;
    const totalValue = leads.reduce((sum, lead) => sum + lead.value, 0);
    const wonDeals = leads.filter(lead => lead.status === 'won').length;
    const lostDeals = leads.filter(lead => lead.status === 'lost').length;
    const activeLeads = leads.filter(lead => lead.status === 'active');
    const conversionRate = totalLeads > 0 ? (wonDeals / totalLeads) * 100 : 0;
    const avgDealSize = activeLeads.length > 0 ? totalValue / activeLeads.length : 0;
    const leadsThisMonth = leads.filter(lead => {
      const now = new Date();
      const leadDate = new Date(lead.createdAt);
      return leadDate.getMonth() === now.getMonth() && 
             leadDate.getFullYear() === now.getFullYear();
    }).length;
    const pipelineValue = activeLeads.reduce((sum, lead) => sum + lead.value, 0);

    return {
      totalLeads,
      totalValue,
      conversionRate,
      avgDealSize,
      leadsThisMonth,
      wonDeals,
      lostDeals,
      pipelineValue
    };
  };

  return (
    <CRMContext.Provider value={{
      leads,
      user,
      isAuthenticated,
      addLead,
      updateLead,
      deleteLead,
      addNote,
      login,
      register,
      logout,
      getDashboardMetrics
    }}>
      {children}
    </CRMContext.Provider>
  );
};
