import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Reports = () => {

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary light-title">Relatórios</h1>
          <p className="text-muted-foreground mt-2">Página de relatórios do sistema</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-center">Em Desenvolvimento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg">Esta funcionalidade está sendo desenvolvida.</p>
            <p className="text-sm mt-2">Em breve você terá acesso aos relatórios completos do sistema.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
