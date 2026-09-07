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
    camera.position.set(0, 2.4, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const trackedRoot = new THREE.Group();
    scene.add(trackedRoot);

    // AR.js writes the marker matrix to trackedRoot every frame. Keep model
    // scale and placement on a child so tracking cannot overwrite them.
    const modelRoot = new THREE.Group();
    modelRoot.scale.setScalar(viewMode === "ar" ? 0.18 : 1);
    modelRoot.position.y = viewMode === "ar" ? 0.08 : 0;
    trackedRoot.add(modelRoot);

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
    let protein: THREE.Mesh | null = null;
    let earth: THREE.Mesh | null = null;
    let earthAxis: THREE.Mesh | null = null;
    const animated: THREE.Object3D[] = [];
    const massBlocks: THREE.Mesh[] = [];
    const bubbles: THREE.Mesh[] = [];
    const dnaBases: { left: THREE.Mesh; right: THREE.Mesh; index: number }[] = [];

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
      const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.65, 1.8, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xa9ddff, transparent: true, opacity: 0.42, side: THREE.DoubleSide }));
      vessel.position.y = 0.1;
      modelRoot.add(vessel);
      mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.65, 32), 0x36a6d9, 0, -0.3);
      for (let index = 0; index < 20; index += 1) {
        const bubble = mesh(new THREE.SphereGeometry(0.07 + (index % 3) * 0.02, 10, 8), 0xffffff, ((index * 37) % 10 - 5) / 10, -0.2 + (index % 7) * 0.2);
        bubble.userData.offset = index * 0.37;
        bubbles.push(bubble);
        animated.push(bubble);
      }
    } else if (moduleId === "life") {
      const output = (controlB / 5) * Math.max(0, 1 - controlA * 0.15);
      for (let index = 0; index < 12; index += 1) {
        const angle = index * 0.72;
        const y = -1.5 + index * 0.27;
        const changed = index < controlA;
        const left = mesh(new THREE.SphereGeometry(0.13, 12, 8), changed ? 0xd71920 : 0x1368ce, Math.cos(angle) * 0.55, y, Math.sin(angle) * 0.55);
        const right = mesh(new THREE.SphereGeometry(0.13, 12, 8), changed ? 0xf7c600 : 0x35a873, -Math.cos(angle) * 0.55, y, -Math.sin(angle) * 0.55);
        dnaBases.push({ left, right, index });
      }
      protein = mesh(new THREE.TorusKnotGeometry(0.55, 0.15, 64, 10), 0x7c3aed, 1.65, 0);
      protein.scale.setScalar(0.45 + output);
      animated.push(protein);
    } else {
      const sun = mesh(new THREE.SphereGeometry(0.58, 24, 16), 0xf7c600, -1.9, 0);
      (sun.material as THREE.MeshStandardMaterial).emissive.setHex(0xff8c00);
      (sun.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5;
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.025, 8, 64), material(0x7c8ba3));
      orbit.rotation.x = Math.PI / 2;
      orbit.position.x = -0.1;
      modelRoot.add(orbit);
      const orbitAngle = (controlB * Math.PI) / 6;
      earth = mesh(new THREE.SphereGeometry(0.48, 24, 16), 0x1676c2, -0.1 + Math.cos(orbitAngle) * 1.8, 0, Math.sin(orbitAngle) * 1.8);
      earth.rotation.z = THREE.MathUtils.degToRad(controlA);
      earthAxis = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 8), material(0xffffff));
      earthAxis.rotation.z = earth.rotation.z;
      earthAxis.position.copy(earth.position);
      modelRoot.add(earthAxis);
      animated.push(earth);
    }

    let frame = 0;
    let animationId = 0;
    let arSource: ArToolkitSource | null = null;
    let arContext: ArToolkitContext | null = null;
    let cancelled = false;
    let markerVisible = false;

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
        bubbles.forEach((bubble, index) => { bubble.visible = index < Math.min(current.controlA, current.controlB) * 4; });
        animated.forEach((item) => { item.position.y = -0.4 + ((frame * 1.8 + item.userData.offset) % 1.7); });
      } else if (moduleId === "life") {
        dnaBases.forEach(({ left, right, index }) => {
          (left.material as THREE.MeshStandardMaterial).color.setHex(index < current.controlA ? 0xd71920 : 0x1368ce);
          (right.material as THREE.MeshStandardMaterial).color.setHex(index < current.controlA ? 0xf7c600 : 0x35a873);
        });
        protein?.scale.setScalar(0.45 + (current.controlB / 5) * Math.max(0, 1 - current.controlA * 0.15));
        animated.forEach((item) => { item.rotation.y += 0.012; item.rotation.x += 0.006; });
      } else if (moduleId === "earth-space") {
        const orbitPosition = (current.controlB * Math.PI) / 6;
        if (earth && earthAxis) {
          earth.position.set(-0.1 + Math.cos(orbitPosition) * 1.8, 0, Math.sin(orbitPosition) * 1.8);
          earth.rotation.z = THREE.MathUtils.degToRad(current.controlA);
          earthAxis.position.copy(earth.position);
          earthAxis.rotation.z = earth.rotation.z;
        }
        animated.forEach((item) => { item.rotation.y += 0.01; });
      }
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
  }, [moduleId, viewMode, onArReady, onArStatus]);

  return <div className="three-scene" ref={mountRef} aria-hidden="true" />;
}
