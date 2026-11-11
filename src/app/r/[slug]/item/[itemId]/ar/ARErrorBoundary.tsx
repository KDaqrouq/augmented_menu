"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { useGLTF } from "@react-three/drei";
import { buttonClass } from "@/components/ui";

type Props = {
  children: ReactNode;
  itemHref: string;
  /** Cleared from the loader cache on retry, otherwise the failed load is reused. */
  glbUrl: string;
};

type State = { hasError: boolean; attempt: number };

/**
 * Catches model load failures and other 3D/AR errors.
 * Shows retry + back navigation so there are no dead ends.
 */
export class ARErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, attempt: 0 };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[AR] Error boundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <div>
            <p className="text-lg font-semibold text-stone-900">The 3D model didn’t load</p>
            <p className="mt-1 text-sm text-stone-600">Check your connection and try again.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                useGLTF.clear(this.props.glbUrl);
                this.setState((s) => ({ hasError: false, attempt: s.attempt + 1 }));
              }}
              className={buttonClass("primary", "md")}
            >
              Try again
            </button>
            <Link href={this.props.itemHref} className={buttonClass("secondary", "md")}>
              Back to dish
            </Link>
          </div>
        </div>
      );
    }
    // Remount children on retry so the loader starts fresh.
    return <div key={this.state.attempt} className="h-full">{this.props.children}</div>;
  }
}
