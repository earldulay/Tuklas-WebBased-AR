export async function loadArToolkit() {
  await import("@ar-js-org/ar.js/three.js/build/ar-threex.js");
  return window.THREEx;
}
