"use client";

import { Component } from "react";

// Renders `fallback` instead of `children` once anything below throws -
// a dedicated model that fails to load or parse, or the whole 3D view if
// WebGL can't start - instead of taking the page down with it.
export default class FallbackBoundary extends Component<
  { fallback: React.ReactNode; onError?: (error: unknown) => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
