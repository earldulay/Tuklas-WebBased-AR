import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ViewMode } from "../types/domain";
import { loadArToolkit } from "../lib/arjs";

interface ScienceSceneProps {
  acceleration: number;
  force: number;
  mass: number;
  viewMode: ViewMode;
}

export function ScienceScene({ acceleration, force, mass, viewMode }: ScienceSceneProps) {
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

    const light = new THREE.HemisphereLight(0xffffff, 0x24324d, 2.5);
    scene.add(light);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 0.08, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x7c8ba3, roughness: 0.75 }),
    );
    floor.position.y = -0.42;
    scene.add(floor);

    const cart = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.55, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xd71920, roughness: 0.55 }),
    );
    scene.add(cart);

    const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-2.7, 0.25, 0), Math.max(0.8, force * 0.35), 0xf7c600, 0.28, 0.15);
    scene.add(arrow);

    let frame = 0;
    let animationId = 0;
    const render = () => {
      frame += 0.012;
      cart.position.x = -2 + Math.sin(frame * Math.max(0.4, acceleration)) * 0.55;
      cart.position.y = -0.06 + mass * 0.015;
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(render);
    };

    render();

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    window.addEventListener("resize", resize);

    if (viewMode === "ar") {
      loadArToolkit().catch(() => undefined);
    }

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [acceleration, force, mass, viewMode]);

  return <div className="three-scene" ref={mountRef} aria-hidden="true" />;
}
