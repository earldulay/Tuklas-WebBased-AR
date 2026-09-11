declare global {
  interface ArToolkitSource {
    domElement: HTMLElement;
    ready: boolean;
    init(onReady?: () => void, onError?: (error: { name?: string; message?: string }) => void): void;
    onResize(arContext: ArToolkitContext, renderer: THREE.WebGLRenderer, camera: THREE.Camera): void;
    dispose?(): void;
  }

  interface ArToolkitContext {
    dispose?: () => void;
    init(onReady?: () => void): void;
    update(element: HTMLElement): void;
    getProjectionMatrix(): THREE.Matrix4;
    arController?: {
      canvas?: HTMLCanvasElement;
      dispose?: () => void;
    };
  }

  interface Window {
    THREEx?: {
      ArToolkitSource?: new (parameters: Record<string, unknown>) => ArToolkitSource;
      ArToolkitContext?: new (parameters: Record<string, unknown>) => ArToolkitContext;
      ArMarkerControls?: new (
        context: ArToolkitContext,
        object3d: THREE.Object3D,
        parameters: Record<string, unknown>,
      ) => unknown;
    };
  }
}

export {};
