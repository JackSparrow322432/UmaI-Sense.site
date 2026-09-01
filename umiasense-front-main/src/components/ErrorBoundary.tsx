import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  crashed: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { crashed: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ crashed: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 overflow-hidden text-center">
          
          <div className="px-6 py-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FFF3EA] mb-5">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E07628" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-2">Что-то пошло не так</h2>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition-all shadow-sm"
            >
              Перезагрузить
            </button>
            {this.state.error && (
              <p className="text-[10px] text-gray-300 mt-4 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
}
