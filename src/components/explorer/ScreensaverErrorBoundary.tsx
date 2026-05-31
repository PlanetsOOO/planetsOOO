"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { isScreensaverMode } from "@/lib/screensaverConfig";

interface Props {
  children: ReactNode;
}

interface State {
  error: string | null;
}

export class ScreensaverErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error: error.message || "Render error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screensaver render error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex h-screen w-full items-center justify-center bg-[#030508] p-8">
        <div className="max-w-md space-y-3 text-center">
          <p className="text-sm text-zinc-300">Orbit screensaver failed to start</p>
          <p className="font-mono text-xs text-zinc-500 break-words">
            {this.state.error}
          </p>
          <p className="text-xs text-zinc-600">
            Try opening{" "}
            <span className="text-zinc-400">
              {typeof window !== "undefined" ? window.location.href : ""}
            </span>{" "}
            in a normal Chrome tab first.
          </p>
        </div>
      </main>
    );
  }
}

export function ScreensaverBootGate({ children }: Props) {
  if (!isScreensaverMode()) return children;
  return <ScreensaverErrorBoundary>{children}</ScreensaverErrorBoundary>;
}
