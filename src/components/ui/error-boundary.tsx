import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled rendering error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-6 py-8 text-center"
        >
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive"
            aria-hidden
          >
            <AlertTriangle size={22} strokeWidth={1.75} />
          </div>
          <div className="flex max-w-md flex-col items-center gap-2">
            <h3 className="font-primary text-sm font-semibold tracking-tight text-foreground">
              {this.props.fallbackTitle || "Something went wrong"}
            </h3>
            <p className="font-primary text-sm leading-relaxed text-muted-foreground">
              {this.props.fallbackDescription ||
                "We couldn't display this section correctly. Please try again."}
            </p>
          </div>
          <button
            type="button"
            className="ax-btn accent inline-flex items-center gap-1.5"
            onClick={this.handleReset}
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
