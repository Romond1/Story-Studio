import { Component, type ReactNode } from 'react';

interface Props {
  recoveryKey: string;
  onError: (message: string) => void;
  children: ReactNode;
}

/** No error details or teacher controls are rendered on the shared student surface. */
export class StudentSceneBoundary extends Component<Props, { failed: boolean; recoveryKey: string }> {
  state = { failed: false, recoveryKey: this.props.recoveryKey };

  static getDerivedStateFromProps(props: Props, state: { recoveryKey: string }) {
    return props.recoveryKey !== state.recoveryKey ? { failed: false, recoveryKey: props.recoveryKey } : null;
  }

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : 'The student scene could not render.';
    this.props.onError(message.slice(0, 2048));
  }

  render() {
    return this.state.failed ? <p>The lesson display is temporarily unavailable.</p> : this.props.children;
  }
}
