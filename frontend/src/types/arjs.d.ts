declare global {
  interface Window {
    THREEx?: {
      ArToolkitSource?: new (parameters: Record<string, unknown>) => unknown;
      ArToolkitContext?: new (parameters: Record<string, unknown>) => unknown;
      ArMarkerControls?: new (...parameters: unknown[]) => unknown;
    };
  }
}

export {};
