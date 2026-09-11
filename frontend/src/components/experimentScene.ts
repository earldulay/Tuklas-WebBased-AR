import * as THREE from "three";
import { circuitState, complement, earthLayers, mutationState, originalDna, template, type LabState } from "../lib/experiments";

/** All experiment content fits the same six-unit presentation area in AR and 3D. */
export function createExperimentScene(root: THREE.Group, id: string) {
  const updates: ((time: number, a: number, b: number, lab: LabState) => void)[] = [];
  const mesh = (geometry: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, parent: THREE.Object3D = root) => {
    const item = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide }));
    item.position.set(x, y, z); parent.add(item); return item;
  };
  const sphere = (color: number, x: number, y: number, r = 0.13, parent: THREE.Object3D = root) => mesh(new THREE.SphereGeometry(r, 20, 12), color, x, y, 0, parent);
  const line = (points: number[][], color = 0x486480, parent: THREE.Object3D = root) => {
    const item = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p[0], p[1], p[2] || 0))), new THREE.LineBasicMaterial({ color })); parent.add(item); return item;
  };
  const label = (text: string, x: number, y: number, width = 1.5, parent: THREE.Object3D = root, aspect = 8) => {
    const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 768 / aspect;
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false }));
    sprite.position.set(x, y, 0.18); sprite.scale.set(width, width / aspect, 1); sprite.renderOrder = 10; parent.add(sprite);
    let previous = "";
    const set = (next: string) => { if (next === previous) return; previous = next; const ctx = canvas.getContext("2d")!; ctx.clearRect(0, 0, 768, canvas.height); ctx.fillStyle = "rgba(247,251,255,0.96)"; ctx.fillRect(0, 0, 768, canvas.height); ctx.font = `bold ${canvas.height * 0.7}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#172c45"; ctx.fillText(next, 384, canvas.height / 2, 740); texture.needsUpdate = true; };
    set(text); return { sprite, set };
  };
  if (["inertia", "force-mass", "launcher"].includes(id)) {
    mesh(new THREE.BoxGeometry(5.4, 0.1, 0.9), 0x8094a6, 0, -0.4);
    const cart = new THREE.Group(); root.add(cart);
    mesh(new THREE.BoxGeometry(0.75, 0.35, 0.6), 0xdb3744, 0, 0, 0, cart);
    [-0.24, 0.24].forEach(x => [-0.3, 0.3].forEach(z => mesh(new THREE.SphereGeometry(0.13, 16, 10), 0x24344a, x, -0.23, z, cart)));
    const blocks = [0, 1, 2, 3].map(i => mesh(new THREE.BoxGeometry(0.42, 0.11, 0.35), 0x354963, 0, 0.24 + i * 0.12, 0, cart));
    const forward = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-0.4, 1.25, 0), 1, 0x16853f, 0.22, 0.14); root.add(forward);
    const backward = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0.4, 1.85, 0), 1, 0x2988d5, 0.22, 0.14); root.add(backward); backward.visible = id === "launcher";
    const balloon = sphere(0x45b9c5, 0, 0.63, 0.35, cart); balloon.scale.x = 1.5; balloon.visible = id === "launcher";
    label(id === "launcher" ? "Air backward / cart forward" : "Frictionless track; wraps at edge", 0, -0.85, 4.5);
    const forceLabel = label("", 0, 2.25, 3.6);
    updates.push((time, a, b) => { const acceleration = a / (id === "inertia" ? 1 : b); const distance = (id === "inertia" ? b : 0) * time + 0.5 * acceleration * time * time; cart.position.x = -2 + distance % 4; blocks.forEach((block, i) => { block.visible = id === "force-mass" && i < b; }); forward.visible = a > 0; backward.visible = id === "launcher" && a > 0; forward.setLength(0.4 + a * 0.25, 0.22, 0.14); backward.setLength(0.4 + a * 0.25, 0.22, 0.14); forceLabel.set(id === "launcher" ? `Equal forces: ${a} N each` : `a = ${acceleration.toFixed(2)} m/s²`); });
  } else if (["series", "parallel", "home-circuit"].includes(id)) {
    const wiring = new THREE.Group(); root.add(wiring);
    const bulbs = [0, 1, 2].map(i => sphere(0xf5d357, -1.5 + i * 1.5, 0.6, 0.27));
    const bulbLabels = bulbs.map((_, i) => label(`Bulb ${i + 1}`, -1.5 + i * 1.5, 1.15, 1.25, root, 4));
    const batteries = [0, 1, 2].map(i => mesh(new THREE.BoxGeometry(0.42, 0.35, 0.2), 0x344a65, -0.52 + i * 0.52, -1.15));
    const batteryLabel = label("", 0, -1.62, 3);
    const switchLabel = label("", 0, 1.7, 4);
    const electrons = Array.from({ length: 24 }, () => sphere(0x00a7e6, 0, 0, 0.055));
    let signature = "";
    let paths: THREE.Vector3[][] = [];
    updates.push((time, a, b, lab) => {
      const c = circuitState(id, a, b, lab);
      const next = `${c.parallel}:${c.count}:${lab.branchMask}:${b}`;
      if (next !== signature) {
        signature = next;
        wiring.children.forEach(object => { const l = object as THREE.Line; l.geometry.dispose(); (l.material as THREE.Material).dispose(); }); wiring.clear(); paths = [];
        if (c.parallel) {
          line([[-2.2, -1.15], [-2.2, 0.8]], 0x486480, wiring); line([[2.2, -1.15], [2.2, 0.8]], 0x486480, wiring);
          for (let i = 0; i < 3; i++) { const y = 0.8 - i * 0.65; bulbs[i].position.set(0.8, y, 0); bulbLabels[i].sprite.position.set(0.8, y + 0.3, 0.18); if (lab.branchMask & (1 << i)) { const points = [[0, -1.15], [-2.2, -1.15], [-2.2, y], [2.2, y], [2.2, -1.15], [0, -1.15]]; line(points, 0x486480, wiring); paths.push(points.map(p => new THREE.Vector3(p[0], p[1], 0))); } }
        } else {
          const points = [[0, -1.15], [-2.2, -1.15], [-2.2, 0.6], [2.2, 0.6], [2.2, -1.15], [0, -1.15]]; line(points, 0x486480, wiring); paths = [points.map(p => new THREE.Vector3(p[0], p[1], 0))];
          bulbs.forEach((bulb, i) => { bulb.position.set(-1.5 + i * 1.5, 0.6, 0); bulbLabels[i].sprite.position.set(-1.5 + i * 1.5, 1.05, 0.18); });
        }
      }
      batteries.forEach((battery, i) => { battery.visible = i < (id === "home-circuit" ? b : a); battery.material.color.setHex(c.tripped ? 0xd63242 : 0x344a65); });
      batteryLabel.set(`${c.voltage} V · ${c.current.toFixed(2)} A total`);
      switchLabel.set(c.tripped ? "Fuse OPEN (> 1.5 A)" : lab.closed ? "Switch CLOSED" : "Switch OPEN");
      bulbs.forEach((bulb, i) => { const installed = id === "series" ? i < b : Boolean(lab.branchMask & (1 << i)); bulb.visible = installed; bulbLabels[i].sprite.visible = installed; bulb.material.emissive.setHex(0xffb000); bulb.material.emissiveIntensity = c.current > 0 && installed ? Math.min(2, c.power / 1.7) : 0; bulb.material.color.setHex(c.current > 0 ? 0xffd657 : 0x617183); });
      electrons.forEach((electron, i) => { electron.visible = c.current > 0 && paths.length > 0; if (!electron.visible) return; const path = paths[i % paths.length]; const progress = ((time * c.branchCurrent * 0.45 + i / electrons.length) % 1) * (path.length - 1); const segment = Math.floor(progress); electron.position.copy(path[segment]).lerp(path[segment + 1], progress - segment); });
    });
  } else if (id === "chemical-change") {
    const jar = mesh(new THREE.CylinderGeometry(0.9, 0.8, 1.6, 32, 1, true), 0x7ac2dc, 0, 0);
    jar.material.transparent = true; jar.material.opacity = 0.2; jar.material.depthWrite = false;
    const liquid = mesh(new THREE.CylinderGeometry(0.76, 0.7, 0.55, 32), 0x7cbacd, 0, -0.47);
    const powder = mesh(new THREE.ConeGeometry(0.4, 0.3, 24), 0xfaf3db, 0, -0.5);
    const bubbles = Array.from({ length: 25 }, (_, i) => sphere(0xffffff, Math.sin(i * 2.4) * 0.6, 0, 0.065));
    label("Vinegar + baking soda", 0, -1.2, 4);
    const result = label("", 0, 1.65, 4.7);
    updates.push((time, a, b) => { liquid.visible = a > 0; powder.visible = b > 0; result.set(a && b ? "New substance: CO₂ gas ↑" : "Add both ingredients to react"); bubbles.forEach((bubble, i) => { bubble.visible = a > 0 && b > 0 && i < Math.min(a, b) * 8; bubble.position.y = -0.3 + ((time * 0.6 + i * 0.11) % 1.65); }); });
  } else if (id === "bonding") {
    const sodium = sphere(0xab86da, -1.15, 0, 0.48); const chlorine = sphere(0x4caf71, 1.15, 0, 0.6); const hydrogen = sphere(0xe0e9f2, 0, -1, 0.25);
    const first = label("Na", -1.15, 0.95, 0.9, root, 2); const second = label("Cl", 1.15, 0.95, 0.9, root, 2); const third = label("H", 0, -1.5, 0.6, root, 2);
    const electrons = Array.from({ length: 8 }, () => sphere(0xffca28, 0, 0, 0.07));
    const shared = Array.from({ length: 4 }, () => sphere(0xffca28, 0, 0, 0.07));
    const bond1 = line([[-1.15, 0], [1.15, 0]], 0x567890); const bond2 = line([[1.15, 0], [0, -1]], 0x567890);
    updates.push((_time, a, b, lab) => {
      root.rotation.y = b * Math.PI / 8;
      sodium.material.color.setHex(a ? 0xe0e9f2 : 0xab86da); chlorine.material.color.setHex(a ? 0xea615b : 0x4caf71);
      first.set(a ? "H" : lab.electrons ? "Na⁺" : "Na"); second.set(a ? "O" : lab.electrons ? "Cl⁻" : "Cl"); hydrogen.visible = third.sprite.visible = Boolean(a);
      bond1.visible = a ? lab.electrons >= 1 : false; bond2.visible = Boolean(a && lab.electrons >= 2);
      electrons.forEach((electron, i) => { electron.visible = a ? i < 4 : true; if (a) electron.position.set(1.15 + Math.cos(i * 0.25 + 0.7) * 0.78, Math.sin(i * 0.25 + 0.7) * 0.78, 0); else if (i === 7 && !lab.electrons) electron.position.set(-1.15, -0.68, 0); else electron.position.set(1.15 + Math.cos(i * Math.PI / 4) * 0.78, Math.sin(i * Math.PI / 4) * 0.78, 0); });
      shared.forEach((electron, i) => { electron.visible = Boolean(a && i < lab.electrons * 2); electron.position.set(i < 2 ? (i % 2) * 0.18 - 0.09 : 0.52 + (i % 2) * 0.16, i < 2 ? 0 : -0.5, 0.12); });
    });
  } else if (id === "seismic") {
    mesh(new THREE.BoxGeometry(4.8, 1.5, 0.12), 0x53687c, 0, 0, -0.2);
    const particles = Array.from({ length: 36 }, (_, i) => sphere(0xffd454, -2.1 + (i % 12) * 0.38, -0.45 + Math.floor(i / 12) * 0.45, 0.06));
    const wave = label("", 0, 1.2, 4.5); label("Travel direction →", 0, -1.1, 3.5);
    updates.push((time, a, b) => { wave.set(a && b ? "S-wave blocked by liquid" : a ? "S-wave: transverse displacement" : "P-wave: compression and expansion"); particles.forEach((particle, i) => { const x = -2.1 + (i % 12) * 0.38; const y = -0.45 + Math.floor(i / 12) * 0.45; const offset = a && b ? 0 : Math.sin(x * 4 - time * (a ? 4 : 7)) * 0.16; particle.position.set(x + (a ? 0 : offset), y + (a ? offset : 0), 0); }); });
  } else if (id === "earth-scale") {
    const rings = earthLayers.map(l => mesh(new THREE.RingGeometry(l.inner / 6371 * 1.75, l.outer / 6371 * 1.75, 128), l.color));
    const outline = line(Array.from({ length: 129 }, (_, i) => [Math.cos(i / 128 * Math.PI * 2) * 1.76, Math.sin(i / 128 * Math.PI * 2) * 1.76]), 0x647a8c);
    const caption = label("", 0, 2.15, 5.4);
    const detail = new THREE.Group(); root.add(detail);
    const surface = [0, 35, 100, 350];
    for (let i = 0; i < 3; i++) { const top = 1.5 - surface[i] / 100; const bottom = 1.5 - surface[i + 1] / 100; mesh(new THREE.PlaneGeometry(2.3, top - bottom), earthLayers[i].color, -0.9, (top + bottom) / 2, 0, detail); label(`${surface[i]}–${surface[i + 1]} km`, 1.2, (top + bottom) / 2, 2.1, detail); }
    label("Crust / rigid mantle / asthenosphere", 0, -2.3, 5.2, detail);
    updates.push((_time, a, b, lab) => { outline.visible = !a; detail.visible = Boolean(a); rings.forEach((ring, i) => { const order = [5, 4, 3, 0].indexOf(i); ring.visible = !a && (order >= 0 ? order < lab.layers : lab.layers === 4 && i === b); ring.position.z = i === 1 || i === 2 ? 0.05 : 0; ring.material.emissive.setHex(i === b ? 0x443322 : 0); }); caption.set(lab.layers === 0 && !a ? "Add layers from the center outward" : `${earthLayers[b].name}: ${earthLayers[b].depth}`); });
  } else if (id === "replication" || id === "mutation") {
    const colors: Record<string, number> = { A: 0x3ea870, T: 0xd76164, C: 0x408bd0, G: 0xd8b238, "": 0x9caaba };
    const count = id === "replication" ? 24 : 25;
    const bases = Array.from({ length: count }, () => sphere(0x9caaba, 0, 0, 0.14));
    const labels = bases.map(() => label("?", 0, 0, 0.28, root, 1));
    const bonds = id === "replication" ? Array.from({ length: 12 }, () => line([[0, 0], [0, 0]], 0x617e93)) : [];
    const captions = [label("", 0, 1.9, 5), label("", 0, -1.8, 5)];
    updates.push((_time, a, b, lab) => {
      if (id === "replication") {
        root.rotation.y = b * Math.PI / 12;
        captions[0].set(a ? "Daughter 1: old + new" : "Original DNA: paired templates"); captions[1].set(a ? "Daughter 2: old + new" : "Separate the strands to copy");
        bases.forEach((base, i) => { const row = Math.floor(i / 6); const col = i % 6; const old = row === 0 || row === 2; const value = row === 0 ? template[col] : row === 2 ? complement(template[col]) : lab.basePairs[(row === 1 ? 0 : 6) + col]; const correct = old || value === (row === 1 ? complement(template[col]) : template[col]); base.visible = labels[i].sprite.visible = Boolean(a) || old; base.position.set(-1.75 + col * 0.7, a ? 1.1 - row * 0.7 : row === 0 ? 0.4 : -0.4, 0); base.material.color.setHex(!value ? colors[""] : correct ? colors[value] : 0xe64b38); labels[i].set(value || "?"); labels[i].sprite.position.set(base.position.x, base.position.y, 0.22); });
        bonds.forEach((bond, i) => { const col = i % 6; const first = i < 6 ? col : col + 12; const second = a ? first + 6 : col + 12; const value = lab.basePairs[i]; bond.visible = a ? value === (i < 6 ? complement(template[col]) : template[col]) : i < 6; bond.geometry.setFromPoints([bases[first].position, bases[second].position]); });
      } else {
        const mutation = mutationState(a, b); captions[0].set("Original coding DNA (5′ → 3′)"); captions[1].set("Edited coding DNA · groups of 3 = codons");
        bases.forEach((base, i) => { const original = i < 12; const col = original ? i : i - 12; const value = original ? originalDna[col] : mutation.dna[col]; base.visible = labels[i].sprite.visible = Boolean(value); base.position.set(-2.5 + col * 0.4 + Math.floor(col / 3) * 0.08, original ? 0.7 : -0.7, 0); base.scale.setScalar(col === b - 1 && !original && a ? 1.3 : 1); base.material.color.setHex(colors[value] || 0x9caaba); labels[i].set(value || ""); labels[i].sprite.position.set(base.position.x, base.position.y, 0.22); });
      }
    });
  } else throw new Error(`Unknown experiment: ${id}`);
  return (time: number, a: number, b: number, lab: LabState) => updates.forEach(update => update(time, a, b, lab));
}
