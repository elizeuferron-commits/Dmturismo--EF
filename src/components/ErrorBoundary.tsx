import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[DM Turismo] Uncaught Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    window.location.hash = '/';
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 mx-auto">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-black uppercase tracking-wider text-white">
                Ocorreu uma Inconformidade
              </h2>
              <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                O aplicativo encontrou um erro inesperado ao carregar. Você pode recarregar a página para restaurar o estado normal.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-left overflow-x-auto max-h-32">
                <code className="text-[10px] text-red-400 font-mono break-all leading-tight block">
                  {this.state.error.toString()}
                </code>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs uppercase tracking-wider py-3 px-4 rounded-xl transition-all cursor-pointer"
              >
                <Home size={16} />
                Ir para o Início
              </button>

              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-accent hover:bg-white text-zinc-950 font-black text-xs uppercase tracking-wider py-3 px-4 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                <RefreshCw size={16} />
                Recarregar App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
