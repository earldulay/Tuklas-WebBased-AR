import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ViewMode } from "../types/domain";
import { loadArToolkit } from "../lib/arjs";

interface ScienceSceneProps {
  moduleId: string;
  controlA: number;
  controlB: number;
  acceleration: number;
  force: number;
  mass: number;
  viewMode: ViewMode;
  onArReady?: (ready: boolean) => void;
  onArStatus?: (status: string) => void;
}

const cameraParametersUrl = "/assets/camera_para.dat";
const tuklasMarkerUrl = "/assets/tuklas-marker.patt";

export function ScienceScene({ moduleId, controlA, controlB, acceleration, force, mass, viewMode, onArReady, onArStatus }: ScienceSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const valuesRef = useRef({ controlA, controlB, acceleration, force, mass });
  valuesRef.current = { controlA, controlB, acceleration, force, mass };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    if (viewMode === "fallback") camera.position.set(0, 2.4, 6);

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
    modelRoot.scale.setScalar(viewMode === "ar" ? 0.18 : 1);
    modelRoot.position.y = viewMode === "ar" ? 0.08 : 0;
    presentationRoot.add(modelRoot);

    if (viewMode === "ar") {
      const markerSurface = new THREE.Mesh(
        new THREE.PlaneGeometry(5.4, 5.4),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
      );
      markerSurface.rotation.x = -Math.PI / 2;
      markerSurface.position.y = -0.45;
      modelRoot.add(markerSurface);
    }

    const light = new THREE.HemisphereLight(0xffffff, 0x24324d, 2.5);
    modelRoot.add(light);

    const material = (color: number, emissive = 0) => new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.55 });
    const mesh = (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z = 0) => {
      const item = new THREE.Mesh(geometry, material(color));
      item.position.set(x, y, z);
      modelRoot.add(item);
      return item;
    };

    let cart: THREE.Mesh | null = null;
    let forceArrow: THREE.ArrowHelper | null = null;
    let bulb: THREE.Mesh | null = null;
    const animated: THREE.Object3D[] = [];
    const massBlocks: THREE.Mesh[] = [];
    const matterParticles: THREE.Mesh[] = [];
    const cellParts: THREE.Object3D[] = [];
    const earthLayers: THREE.Mesh[] = [];

    if (moduleId === "motion") {
      mesh(new THREE.BoxGeometry(5.8, 0.08, 1.2), 0x7c8ba3, 0, -0.42);
      cart = mesh(new THREE.BoxGeometry(1.1, 0.55, 0.8), 0xd71920, 0, 0);
      forceArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-2.7, 0.25, 0), 1, 0xf7c600, 0.28, 0.15);
      modelRoot.add(forceArrow);
      for (let index = 0; index < 4; index += 1) massBlocks.push(mesh(new THREE.BoxGeometry(0.5, 0.12, 0.45), 0x24324d, 0, 0.38 + index * 0.13));
    } else if (moduleId === "electricity") {
      const current = controlA / controlB;
      const wire = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.045, 10, 64), material(0x29384f));
      wire.rotation.x = Math.PI / 2;
      modelRoot.add(wire);
      mesh(new THREE.BoxGeometry(0.75, 0.9, 0.45), 0x24324d, -1.75, 0);
      bulb = mesh(new THREE.SphereGeometry(0.46, 24, 16), 0xffd64d, 1.75, 0);
      (bulb.material as THREE.MeshStandardMaterial).emissive.setHex(0xffb000);
      (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.min(3, current / 1.5);
      for (let index = 0; index < 12; index += 1) {
        const electron = mesh(new THREE.SphereGeometry(0.07, 10, 8), 0x2fb7ff, 0, 0);
        electron.userData.offset = index / 12;
        animated.push(electron);
      }
    } else if (moduleId === "materials") {
      const container = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 2.5, 2.5),
        new THREE.MeshBasicMaterial({ color: 0x7c8ba3, wireframe: true, transparent: true, opacity: 0.55 }),
      );
      modelRoot.add(container);
      for (let index = 0; index < 30; index += 1) {
        const particle = mesh(new THREE.SphereGeometry(0.13, 12, 8), 0x1676c2, 0, 0);
        particle.userData.phase = index * 1.73;
        matterParticles.push(particle);
      }
    } else if (moduleId === "life") {
      const membrane = new THREE.Mesh(new THREE.SphereGeometry(1.55, 32, 20), new THREE.MeshStandardMaterial({ color: 0x62c98d, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
      membrane.scale.set(1.25, 0.78, 0.9);
      modelRoot.add(membrane);
      cellParts[4] = membrane;
      cellParts[1] = mesh(new THREE.SphereGeometry(0.48, 24, 16), 0x7c3aed, -0.38, 0.15, 0.25);
      const mitochondria = new THREE.Group();
      [-0.8, 0.72].forEach((x, index) => {
        const part = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.48, 6, 12), material(0xd95d39));
        part.position.set(x, index ? -0.42 : 0.48, -0.15);
        part.rotation.z = Math.PI / 2;
        mitochondria.add(part);
      });
      modelRoot.add(mitochondria);
      cellParts[2] = mitochondria;
      const chloroplasts = new THREE.Group();
      [-0.72, 0.62].forEach((x, index) => {
        const part = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 6, 12), material(0x178447));
        part.position.set(x, index ? 0.62 : -0.55, 0.28);
        part.rotation.z = Math.PI / 2;
        chloroplasts.add(part);
      });
      modelRoot.add(chloroplasts);
      cellParts[3] = chloroplasts;
      const vacuole = new THREE.Mesh(new THREE.SphereGeometry(0.72, 24, 16), new THREE.MeshStandardMaterial({ color: 0x66c7e8, transparent: true, opacity: 0.4 }));
      vacuole.position.set(0.45, 0, -0.18);
      vacuole.scale.y = 0.72;
      modelRoot.add(vacuole);
    } else {
      const radii = [1.5, 1.25, 0.82, 0.46];
      const colors = [0x356f3d, 0xe47b32, 0xf0b429, 0xd71920];
      radii.forEach((radius, index) => {
        const layer = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 32, 20, 0, Math.PI),
          new THREE.MeshStandardMaterial({ color: colors[index], roughness: 0.65, side: THREE.DoubleSide }),
        );
        layer.rotation.y = -Math.PI / 2;
        modelRoot.add(layer);
        earthLayers.push(layer);
      });
    }

    let frame = 0;
    let animationId = 0;
    let arSource: ArToolkitSource | null = null;
    let arContext: ArToolkitContext | null = null;
    let cancelled = false;
    let markerVisible = false;
    let hasStablePose = false;
    let missedFrames = 0;

    const render = () => {
      frame += 0.012;
      const current = valuesRef.current;
      if (cart) {
        cart.position.x = -2 + Math.sin(frame * Math.max(0.4, current.acceleration)) * 0.55;
        cart.position.y = -0.06 + current.mass * 0.015;
        forceArrow?.setLength(Math.max(0.8, current.force * 0.35), 0.28, 0.15);
        massBlocks.forEach((block, index) => { block.visible = index < current.mass; });
      }
      if (moduleId === "electricity") {
        const currentFlow = current.controlA / current.controlB;
        if (bulb) (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.min(3, currentFlow / 1.5);
        animated.forEach((item) => {
          const angle = (frame * Math.max(0.25, currentFlow) + item.userData.offset) * Math.PI * 2;
          item.position.set(Math.cos(angle) * 1.8, 0, Math.sin(angle) * 1.8);
        });
      } else if (moduleId === "materials") {
        const state = current.controlA <= 0 ? "solid" : current.controlA < 100 ? "liquid" : "gas";
        matterParticles.forEach((particle, index) => {
          particle.visible = index < current.controlB;
          const phase = particle.userData.phase as number;
          if (state === "solid") {
            const x = ((index % 5) - 2) * 0.38;
            const y = (Math.floor(index / 5) % 3) * 0.38 - 0.82;
            const z = (Math.floor(index / 15) - 0.5) * 0.38;
            particle.position.set(x + Math.sin(frame * 7 + phase) * 0.018, y, z);
          } else if (state === "liquid") {
            particle.position.set(
              Math.sin(frame * 1.8 + phase) * 0.92,
              -0.65 + ((index * 0.23 + frame * 0.35) % 1.25),
              Math.cos(frame * 1.45 + phase * 1.3) * 0.85,
            );
          } else {
            particle.position.set(
              Math.sin(frame * 3.8 + phase) * 1.02,
              Math.sin(frame * 3.1 + phase * 1.7) * 1.02,
              Math.cos(frame * 3.5 + phase * 1.2) * 1.02,
            );
          }
        });
      } else if (moduleId === "life") {
        cellParts.forEach((part, index) => { if (part) part.visible = current.controlA !== index; });
        modelRoot.rotation.y = current.controlB * (Math.PI / 2) + Math.sin(frame * 0.4) * 0.08;
      } else if (moduleId === "earth-space") {
        earthLayers.forEach((layer, index) => {
          layer.position.x = index * current.controlA * 0.72;
          const layerMaterial = layer.material as THREE.MeshStandardMaterial;
          layerMaterial.emissive.setHex(index === current.controlB ? 0x333333 : 0x000000);
          layerMaterial.emissiveIntensity = index === current.controlB ? 0.8 : 0;
        });
        modelRoot.rotation.y = -0.35 + Math.sin(frame * 0.35) * 0.06;
      }
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
          onArStatus?.(markerVisible ? "Tuklas marker detected." : "Looking for the Tuklas marker...");
        }
      }
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(render);
    };

    const resize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      if (viewMode === "ar" && arSource && arContext) {
        arSource.onResize(arContext, renderer, camera);
      } else {
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
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

          new THREEx.ArMarkerControls(context, trackedRoot, {
            type: "pattern",
            patternUrl: tuklasMarkerUrl,
            changeMatrixMode: "modelViewMatrix",
            minConfidence: 0.7,
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
  }, [moduleId, viewMode, onArReady, onArStatus]);

  return <div className="three-scene" ref={mountRef} aria-hidden="true" />;
}
