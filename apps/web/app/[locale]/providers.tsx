"use client";

import { type ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper for the application.
 * Contains context providers that need client-side rendering.
 */
export function Providers({ children }: ProvidersProps) {
  return <>{children}</>;
}