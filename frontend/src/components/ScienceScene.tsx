import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ViewMode } from "../types/domain";
import { createExperimentScene } from "./experimentScene";
import type { LabState } from "../lib/experiments";
import { loadArToolkit } from "../lib/arjs";

interface ScienceSceneProps {
  moduleId: string;
  controlA: number;
  controlB: number;
  lab: LabState;
  trialPulse: number;
  onMarkerChange?: (detected: boolean) => void;
  viewMode: ViewMode;
  onArReady?: (ready: boolean) => void;
  onArStatus?: (status: string) => void;
}

const cameraParametersUrl = "/assets/camera_para.dat";
const tuklasMarkerUrl = "/assets/tuklas-marker.patt";

export function ScienceScene({ moduleId, controlA, controlB, lab, trialPulse, viewMode, onArReady, onArStatus, onMarkerChange }: ScienceSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const valuesRef = useRef({ controlA, controlB, lab, trialPulse });
  valuesRef.current = { controlA, controlB, lab, trialPulse };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    if (viewMode === "fallback") { camera.position.set(0, 1.4, 9); camera.lookAt(0, 0.2, 0); }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const trackedRoot = new THREE.Group();
    scene.add(trackedRoot);

    const presentationRoot = new THREE.Group();
    if (viewMode === "ar") {
      presentationRoot.visible = false;
      scene.add(presentationRoot);
    } else {
      trackedRoot.add(presentationRoot);
    }

    // AR.js writes the marker matrix to trackedRoot every frame. Keep model
    // scale and placement on a child so tracking cannot overwrite them.
    const modelRoot = new THREE.Group();
    modelRoot.scale.setScalar(viewMode === "ar" ? 0.22 : 1);
    modelRoot.position.y = viewMode === "ar" ? 0.55 : 0;
    presentationRoot.add(modelRoot);

    const light = new THREE.HemisphereLight(0xffffff, 0x24324d, 2.5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));

    const billboardRoot = new THREE.Group();
    modelRoot.add(billboardRoot);
    const contentRoot = new THREE.Group();
    billboardRoot.add(contentRoot);
    const updateExperiment = createExperimentScene(contentRoot, moduleId);
    let elapsed = 0;
    let previousTime = performance.now();
    let previousInputs = "";
    let animationId = 0;
    let arSource: ArToolkitSource | null = null;
    let arContext: ArToolkitContext | null = null;
    let cancelled = false;
    let markerVisible = false;
    let hasStablePose = false;
    let missedFrames = 0;

    const render = () => {
      const now = performance.now();
      const current = valuesRef.current;
      const inputs = JSON.stringify(current);
      if (inputs !== previousInputs) { elapsed = 0; previousInputs = inputs; }
      if (viewMode === "fallback" || markerVisible) elapsed += Math.min(0.05, (now - previousTime) / 1000);
      previousTime = now;
      updateExperiment(elapsed, current.controlA, current.controlB, current.lab);
      if (viewMode === "ar" && arSource?.ready && arContext) {
        arContext.update(arSource.domElement);
        if (trackedRoot.visible) {
          missedFrames = 0;
          presentationRoot.visible = true;
          if (!hasStablePose) {
            presentationRoot.position.copy(trackedRoot.position);
            presentationRoot.quaternion.copy(trackedRoot.quaternion);
            presentationRoot.scale.copy(trackedRoot.scale);
            hasStablePose = true;
          } else {
            presentationRoot.position.lerp(trackedRoot.position, 0.32);
            presentationRoot.quaternion.slerp(trackedRoot.quaternion, 0.28);
            presentationRoot.scale.lerp(trackedRoot.scale, 0.32);
          }
        } else if (hasStablePose) {
          missedFrames += 1;
          if (missedFrames > 6) {
            presentationRoot.visible = false;
            hasStablePose = false;
          }
        }
        if (trackedRoot.visible !== markerVisible) {
          markerVisible = trackedRoot.visible;
          onMarkerChange?.(markerVisible);
          onArStatus?.(markerVisible ? "Tuklas marker detected." : "Looking for the Tuklas marker...");
        }
      }
      if (viewMode === "ar") {
        // Face the learner while keeping the model anchored to the tracked marker.
        billboardRoot.quaternion.copy(presentationRoot.quaternion).invert().multiply(camera.quaternion);
      }
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(render);
    };

    const resize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      if (viewMode === "ar" && arSource && arContext) {
        arSource.onResize(arContext, renderer, camera);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      } else if (viewMode === "fallback") {
        camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
        camera.position.z = Math.max(9, 3.2 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
        camera.lookAt(0, 0.2, 0);
        camera.updateProjectionMatrix();
      }
    };

    window.addEventListener("resize", resize);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    if (viewMode === "ar") {
      trackedRoot.visible = false;
      onArReady?.(false);
      onMarkerChange?.(false);
      onArStatus?.("Loading AR marker tracking...");

      loadArToolkit()
        .then((THREEx) => {
          if (cancelled || !THREEx?.ArToolkitSource || !THREEx.ArToolkitContext || !THREEx.ArMarkerControls) return;

          const source = new THREEx.ArToolkitSource({
            sourceType: "webcam",
            sourceWidth: 640,
            sourceHeight: 480,
            displayWidth: mount.clientWidth,
            displayHeight: mount.clientHeight,
          });

          const context = new THREEx.ArToolkitContext({
            cameraParametersUrl,
            detectionMode: "mono",
            patternRatio: 0.5,
            canvasWidth: 640,
            canvasHeight: 480,
          });
          arSource = source;
          arContext = context;

          source.init(
            () => {
              if (cancelled) { stopCamera(); return; }
              mount.prepend(source.domElement);
              source.domElement.classList.add("ar-source-video");
              const video = source.domElement as HTMLVideoElement;
              video.muted = true;
              video.playsInline = true;
              void video.play().catch(() => {
                if (!cancelled) onArStatus?.("Camera playback paused. Switch to 3D and reopen the camera.");
              });
              context.init(() => {
                if (cancelled) { context.dispose?.(); return; }
          new THREEx.ArMarkerControls(context, trackedRoot, {
            type: "pattern",
            patternUrl: tuklasMarkerUrl,
            changeMatrixMode: "modelViewMatrix",
            minConfidence: 0.7,
          });

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

    function stopCamera() {
      const video = arSource?.domElement as HTMLVideoElement | undefined;
      if (video?.srcObject instanceof MediaStream) video.srcObject.getTracks().forEach(track => track.stop());
      if (arSource?.ready) arSource.dispose?.();
      arSource?.domElement?.remove();
    }

    render();

    return () => {
      cancelled = true;
      onArReady?.(false);
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      resizeObserver.disconnect();
      onMarkerChange?.(false);
      stopCamera();
      if (arContext?.arController) arContext.dispose?.();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        const renderable = object as THREE.Mesh;
        if (renderable.geometry) geometries.add(renderable.geometry);
        if (renderable.material) (Array.isArray(renderable.material) ? renderable.material : [renderable.material]).forEach(mat => materials.add(mat));
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(mat => { const map = (mat as THREE.MeshBasicMaterial).map; map?.dispose(); mat.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [moduleId, viewMode, onArReady, onArStatus, onMarkerChange]);

  return <div className="three-scene" ref={mountRef} aria-hidden="true" />;
}
