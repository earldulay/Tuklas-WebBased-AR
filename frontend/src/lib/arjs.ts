export async function loadArToolkit() {
  const toolkit = await import("@ar-js-org/ar.js/three.js/build/ar-threex.mjs");
  const THREEx = toolkit;
  window.THREEx = THREEx;
  return THREEx;
}
