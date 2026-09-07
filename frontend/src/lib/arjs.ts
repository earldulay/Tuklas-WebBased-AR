export async function loadArToolkit() {
  const toolkit = await import("@ar-js-org/ar.js/three.js/build/ar-threex.js");
  const THREEx = toolkit.THREEx || toolkit.default || toolkit["module.exports"] || window.THREEx;
  window.THREEx = THREEx;
  return THREEx;
}
