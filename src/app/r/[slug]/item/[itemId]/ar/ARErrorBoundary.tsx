"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";

type Props = {
  children: ReactNode;
  slug: string;
  itemId: string;
};

type State = { hasError: boolean };

/**
 * Phase 8B: Catches model load failures and other AR errors.
 * Shows retry + back navigation so there are no dead ends.
 */
export class ARErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[AR] Error boundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-900 p-6 text-white">
          <p className="text-center font-medium">
            Failed to load 3D model. Please try again.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false })}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              Retry
            </button>
            <Link
              href={`/r/${this.props.slug}/item/${this.props.itemId}`}
              className="rounded bg-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-600"
            >
              Back to item
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
