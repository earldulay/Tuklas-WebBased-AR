import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ViewMode } from "../types/domain";
import { loadArToolkit } from "../lib/arjs";

interface ScienceSceneProps {
  acceleration: number;
  force: number;
  mass: number;
  viewMode: ViewMode;
  onArReady?: (ready: boolean) => void;
  onArStatus?: (status: string) => void;
}

const cameraParametersUrl = "/assets/camera_para.dat";
const tuklasMarkerUrl = "/assets/tuklas-marker.patt";

export function ScienceScene({ acceleration, force, mass, viewMode, onArReady, onArStatus }: ScienceSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 2.4, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const trackedRoot = new THREE.Group();
    trackedRoot.scale.setScalar(viewMode === "ar" ? 0.18 : 1);
    scene.add(trackedRoot);

    const light = new THREE.HemisphereLight(0xffffff, 0x24324d, 2.5);
    trackedRoot.add(light);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 0.08, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x7c8ba3, roughness: 0.75 }),
    );
    floor.position.y = -0.42;
    trackedRoot.add(floor);

    const cart = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.55, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xd71920, roughness: 0.55 }),
    );
    trackedRoot.add(cart);

    const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-2.7, 0.25, 0), Math.max(0.8, force * 0.35), 0xf7c600, 0.28, 0.15);
    trackedRoot.add(arrow);

    let frame = 0;
    let animationId = 0;
    let arSource: ArToolkitSource | null = null;
    let arContext: ArToolkitContext | null = null;
    let cancelled = false;
    let markerVisible = false;

    const render = () => {
      frame += 0.012;
      cart.position.x = -2 + Math.sin(frame * Math.max(0.4, acceleration)) * 0.55;
      cart.position.y = -0.06 + mass * 0.015;
      if (viewMode === "ar" && arSource?.ready && arContext) {
        arContext.update(arSource.domElement);
        if (trackedRoot.visible !== markerVisible) {
          markerVisible = trackedRoot.visible;
          onArStatus?.(markerVisible ? "Tuklas marker detected." : "Looking for the Tuklas marker...");
        }
      }
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(render);
    };

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      if (viewMode === "ar" && arSource && arContext) {
        arSource.onResize(arContext, renderer, camera);
      }
    };

    window.addEventListener("resize", resize);

    if (viewMode === "ar") {
      trackedRoot.visible = false;
      onArReady?.(false);
      onArStatus?.("Loading AR marker tracking...");

      loadArToolkit()
        .then((THREEx) => {
          if (cancelled || !THREEx?.ArToolkitSource || !THREEx.ArToolkitContext || !THREEx.ArMarkerControls) return;

          const source = new THREEx.ArToolkitSource({
            sourceType: "webcam",
            sourceWidth: 1280,
            sourceHeight: 720,
            displayWidth: mount.clientWidth,
            displayHeight: mount.clientHeight,
          });

          const context = new THREEx.ArToolkitContext({
            cameraParametersUrl,
            detectionMode: "mono",
            patternRatio: 0.5,
          });
          arSource = source;
          arContext = context;

          new THREEx.ArMarkerControls(context, trackedRoot, {
            type: "pattern",
            patternUrl: tuklasMarkerUrl,
            changeMatrixMode: "modelViewMatrix",
          });

          source.init(
            () => {
              if (cancelled) return;
              mount.prepend(source.domElement);
              source.domElement.classList.add("ar-source-video");
              context.init(() => {
                if (cancelled) return;
                camera.projectionMatrix.copy(context.getProjectionMatrix());
                resize();
                onArReady?.(true);
                onArStatus?.("Looking for the Tuklas marker...");
              });
            },
            (error: { message?: string }) => {
              if (cancelled) return;
              onArReady?.(false);
              onArStatus?.(error.message || "Camera failed to start.");
            },
          );
        })
        .catch(() => {
          if (cancelled) return;
          onArReady?.(false);
          onArStatus?.("AR.js failed to load.");
        });
    }

    render();

    return () => {
      cancelled = true;
      onArReady?.(false);
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      arSource?.dispose?.();
      arSource?.domElement.remove();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [acceleration, force, mass, viewMode, onArReady, onArStatus]);

  return <div className="three-scene" ref={mountRef} aria-hidden="true" />;
}
