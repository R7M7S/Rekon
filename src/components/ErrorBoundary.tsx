import { Component, type ReactNode } from 'react';

/** Shows a readable message instead of a blank page if a panel fails to render. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: unknown }, { error: Error | null; key: unknown }> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey: unknown }, state: { key: unknown }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="card">
        <p className="err" role="alert">
          This panel could not be shown: {this.state.error.message}. Try another tab, or reload the page and choose the file again.
        </p>
      </section>
    );
  }
}
