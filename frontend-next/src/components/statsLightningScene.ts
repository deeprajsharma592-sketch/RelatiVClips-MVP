import * as THREE from "three";

// Trace the main silhouette in image coordinates, starting at the upper-left bevel.
const outlinePoints = [
  [0.26, 0.10],
  [0.78, 0.02],
  [0.87, 0.085],
  [0.66, 0.365],
  [0.88, 0.345],
  [0.96, 0.394],
  [0.16, 0.986],
  [0.285, 0.585],
  [0.025, 0.572],
] as const;

const faceHeight = 2.18;

function boltGeometry(faceWidth: number) {
  const shape = new THREE.Shape(
    outlinePoints.map(([u, v]) =>
      new THREE.Vector2((u - 0.5) * faceWidth, (0.5 - v) * faceHeight),
    ),
  );
  const depth = 0.24;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelThickness: 0.06,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  // The cap UVs follow the original silhouette. The sides use a lit material.
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (const { start, count, materialIndex } of geometry.groups) {
    if (materialIndex !== 0) continue;
    for (let index = start; index < start + count; index++) {
      uv.setXY(index, positions.getX(index) / faceWidth + 0.5,
        positions.getY(index) / faceHeight + 0.5);
    }
  }
  return geometry.translate(0, 0, -depth / 2);
}

export function mountLightning(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-0.99, 0.99, 1.36, -1.36, 0.1, 20);
  camera.position.z = 5;

  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const geometry = boltGeometry(faceHeight * image.naturalWidth / image.naturalHeight);
  const face = new THREE.MeshBasicMaterial({
    map: texture,
    alphaTest: 0.35,
    toneMapped: false,
  });
  const edges = new THREE.MeshPhysicalMaterial({
    color: "#f5b18b",
    roughness: 0.23,
    metalness: 0.48,
    clearcoat: 1,
    emissive: "#8e3010",
    emissiveIntensity: 0.22,
  });
  const bolt = new THREE.Mesh(geometry, [face, edges]);
  bolt.rotation.set(0.14, -0.38, 0.08);
  scene.add(bolt, new THREE.HemisphereLight(0xfff1e2, 0xff7029, 2));

  const key = new THREE.DirectionalLight(0xfff3e5, 3);
  key.position.set(-3, 4, 5);
  const rim = new THREE.DirectionalLight(0xff9152, 2);
  rim.position.set(3, 1, -4);
  scene.add(key, rim);

  const draw = () => renderer.render(scene, camera);
  const resize = new ResizeObserver(() => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    draw();
  });
  resize.observe(canvas);

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false;
  let lastFrame: number | undefined;
  const rotate = (time: number) => {
    if (lastFrame !== undefined) {
      bolt.rotation.y += Math.min(time - lastFrame, 50) * 0.0014;
    }
    lastFrame = time;
    draw();
  };
  const updateMotion = () => {
    lastFrame = undefined;
    renderer.setAnimationLoop(visible && !motion.matches ? rotate : null);
  };
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateMotion();
  });
  visibility.observe(canvas);
  motion.addEventListener("change", updateMotion);

  return () => {
    visibility.disconnect();
    resize.disconnect();
    motion.removeEventListener("change", updateMotion);
    renderer.setAnimationLoop(null);
    geometry.dispose();
    texture.dispose();
    face.dispose();
    edges.dispose();
    renderer.dispose();
  };
}
