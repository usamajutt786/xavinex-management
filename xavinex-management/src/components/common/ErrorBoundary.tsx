import React, { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div role="alert" className="bg-white rounded-xl border p-8 max-w-md space-y-4">
        <h1 className="font-bold text-xl text-slate-900">This view could not load</h1>
        <p className="text-sm text-slate-600">Reload the application to try again. Records already saved to the server are retained.</p>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg" onClick={() => window.location.reload()}>Reload application</button>
      </div>
    </main>;
    return this.props.children;
  }
}
