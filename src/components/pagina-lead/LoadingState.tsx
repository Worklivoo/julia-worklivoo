import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  variant?: 'card' | 'inline' | 'full-page';
  message?: string;
  showSpinner?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({ 
  variant = 'card', 
  message = 'Carregando...', 
  showSpinner = true 
}) => {
  if (variant === 'full-page') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          {showSpinner && <Loader2 className="h-8 w-8 animate-spin mx-auto" />}
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 py-4">
        {showSpinner && <Loader2 className="h-4 w-4 animate-spin" />}
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        {showSpinner && (
          <div className="flex items-center gap-2 pt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">{message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Componente específico para loading de anotações
const NotesLoadingState: React.FC = () => {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
};

// Componente específico para loading de cards de informação
const InfoCardLoadingState: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-8 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export { LoadingState, NotesLoadingState, InfoCardLoadingState };
export type { LoadingStateProps };