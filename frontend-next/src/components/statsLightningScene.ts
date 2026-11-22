import * as THREE from "three";

function boltGeometry(depth: number, bevel: number) {
  const outline = new THREE.Shape();
  outline.moveTo(-0.34, 0.91);
  outline.lineTo(0.58, 1.08);
  outline.lineTo(0.16, 0.23);
  outline.lineTo(0.68, 0.34);
  outline.lineTo(-0.42, -1.08);
  outline.lineTo(-0.16, -0.18);
  outline.lineTo(-0.66, -0.26);
  outline.closePath();

  return new THREE.ExtrudeGeometry(outline, {
    depth,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  }).translate(0, 0, -depth / 2);
}

export function mountLightning(canvas: HTMLCanvasElement) {
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

  const glassGeometry = boltGeometry(0.25, 0.077);
  const coreGeometry = boltGeometry(0.31, 0.035);
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#ffc09a",
    roughness: 0.18,
    metalness: 0.22,
    clearcoat: 1,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const orange = new THREE.MeshStandardMaterial({
    color: "#ff7c22",
    emissive: "#ff4900",
    emissiveIntensity: 0.55,
    roughness: 0.28,
  });
  const bolt = new THREE.Group();
  const shell = new THREE.Mesh(glassGeometry, glass);
  const core = new THREE.Mesh(coreGeometry, orange);
  core.scale.set(0.72, 0.79, 1);
  bolt.add(core, shell);
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
    glassGeometry.dispose();
    coreGeometry.dispose();
    glass.dispose();
    orange.dispose();
    renderer.dispose();
  };
}
