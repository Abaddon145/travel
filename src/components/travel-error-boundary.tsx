import { Component, type ReactNode } from "react";
import { DatabaseStatus } from "@/components/database-status";
import { toUserMessage } from "@/db/errors";

type State = { error: Error | null };

export class TravelErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col gap-2">
          <DatabaseStatus kind="error" onRetry={() => this.setState({ error: null })} />
          <p className="sr-only">{toUserMessage(this.state.error)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
