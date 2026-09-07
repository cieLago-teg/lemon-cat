"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

// Global render-error boundary. Shows a visible, recoverable fallback instead of
// a blank screen, and keeps the original error for diagnosis (no swallowing).
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error)
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the original stack; client side has no pino, console is the sink.
    console.error("[ErrorBoundary] render crashed", error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 px-6 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-amber-200/70 bg-white/90 p-6 text-center shadow-[0_18px_45px_-24px_rgba(92,46,16,0.45)]">
          <p className="font-handwriting text-xl font-bold text-amber-900">页面开小差了 🐾</p>
          <p className="mt-2 text-sm text-amber-800/80">
            界面遇到意外错误。你的宠物和档案都已安全保存，刷新即可恢复。
          </p>
          <p className="mt-3 break-words rounded-xl bg-amber-50 px-3 py-2 text-left font-mono text-[11px] text-amber-900/70">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="mt-4 rounded-full bg-amber-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-600"
          >
            重新加载界面
          </button>
        </div>
      </div>
    );
  }
}
