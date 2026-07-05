import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.error('Stats chart failed to load:', error); }
  render() {
    if (this.state.hasError) {
      return <div className="text-slate-500 py-6">A chart failed to load. Try refreshing.</div>;
    }
    return this.props.children;
  }
}
