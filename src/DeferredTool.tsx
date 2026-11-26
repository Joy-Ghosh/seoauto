import React, { Component, Suspense } from "react";
import { LoaderCircle } from "lucide-react";

class ToolBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="error-box" role="alert">
        <p>This tool could not load. Reload the workspace to try again.</p>
        <button className="button secondary" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export default function DeferredTool({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <ToolBoundary>
      <Suspense
        fallback={
          <div className="progress-panel" role="status">
            <LoaderCircle className="spin" size={18} />
            <span>Loading {label}…</span>
          </div>
        }
      >
        {children}
      </Suspense>
    </ToolBoundary>
  );
}
