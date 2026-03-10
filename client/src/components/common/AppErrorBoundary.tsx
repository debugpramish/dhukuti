import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    void error;
    void errorInfo;
    // Error is intentionally swallowed to render graceful fallback.
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">
              We hit an unexpected error while rendering this page.
            </p>
            <Button type="button" className="mt-4" onClick={this.handleReload}>
              Reload page
            </Button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
