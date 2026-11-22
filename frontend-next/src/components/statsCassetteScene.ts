import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

type Point = [number, number, number];

function cassetteLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#dfdbc8";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#17191b";
  ctx.font = "bold 52px monospace";
  ctx.fillText("C-90", 28, 64);
  ctx.font = "bold 31px monospace";
  ctx.fillText("RELATIV", 231, 61);
  ctx.font = "23px monospace";
  ctx.fillText("A   LOW NOISE", 28, 228);
  ["#cb4243", "#e9a849", "#dfd26d", "#70a47a", "#57a3c1"].forEach(
    (color, index) => {
      ctx.fillStyle = color;
      for (const x of [0, 448]) ctx.fillRect(x, 90 + index * 21, 64, 21);
    },
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildCassette(label: THREE.Texture) {
  const player = new THREE.Group();
  const material = (color: string, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.48 });
  const wood = material("#c7926d");
  const dark = material("#252629");
  const silver = material("#929392", 0.6);
  const ivory = material("#efeee5");
  const red = material("#d93532");
  const rubber = material("#635136");
  const reelColors = [material("#60a8ca"), material("#78a25c")];
  const paper = new THREE.MeshStandardMaterial({ map: label });

  function add(
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    position: Point,
  ) {
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.position.set(...position);
    player.add(mesh);
    return mesh;
  }

  function box(
    size: Point,
    position: Point,
    surface: THREE.Material,
    radius = 0.035,
  ) {
    return add(new RoundedBoxGeometry(...size, 2, radius), surface, position);
  }

  function disc(
    radius: number,
    depth: number,
    position: Point,
    surface: THREE.Material,
  ) {
    const mesh = add(
      new THREE.CylinderGeometry(radius, radius, depth, 20),
      surface,
      position,
    );
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  box([2.18, 1.58, 0.58], [0, 0, 0], wood, 0.075);
  box([2.02, 1.27, 0.16], [0, 0.16, 0.32], dark, 0.055);
  add(new THREE.PlaneGeometry(1.81, 0.86), paper, [0, 0.25, 0.403]);
  box([1.34, 0.35, 0.05], [0, 0.23, 0.42], dark);
  box([0.52, 0.17, 0.05], [0, 0.23, 0.45], rubber);
  for (const [index, x] of [-0.47, 0.47].entries()) {
    disc(0.155, 0.06, [x, 0.23, 0.46], dark);
    disc(0.116, 0.06, [x, 0.23, 0.48], reelColors[index]);
    for (let spoke = 0; spoke < 3; spoke++) {
      const tab = box([0.14, 0.033, 0.025], [x, 0.23, 0.52], ivory, 0.01);
      tab.rotation.z = (spoke * Math.PI) / 3;
    }
  }

  for (const x of [-0.91, 0.91]) {
    for (const y of [-0.38, 0.69]) {
      disc(0.036, 0.025, [x, y, 0.41], silver);
      box([0.046, 0.009, 0.01], [x, y, 0.426], dark, 0.002);
    }
  }

  box([1.96, 0.06, 0.45], [0, 0.79, 0], dark);
  box([0.64, 0.16, 0.4], [-0.64, 0.88, 0], red);
  for (const x of [-0.05, 0.36, 0.77]) {
    box([0.35, 0.13, 0.4], [x, 0.865, 0], ivory);
  }

  box([0.79, 0.45, 0.21], [-0.31, -0.3, -0.35], dark);
  box([0.19, 0.45, 0.22], [-0.67, -0.3, -0.35], wood);
  const bracket = box([0.33, 1.05, 0.045], [-0.12, -0.07, -0.465], silver);
  bracket.rotation.z = -0.14;
  box([1.6, 0.12, 0.12], [0, -0.62, 0.32], silver);

  const loop = new THREE.EllipseCurve(0, -0.84, 0.83, 0.16);
  const loopPoints = loop
    .getPoints(32)
    .map(({ x, y }) => new THREE.Vector3(x, y, 0.21 + x * 0.08));
  add(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(loopPoints.slice(0, -1), true),
      48,
      0.045,
      8,
      true,
    ),
    rubber,
    [0, 0, 0],
  );
  const wire = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-0.15, -0.48, -0.42),
    new THREE.Vector3(1.48, -1.02, -0.3),
    new THREE.Vector3(0.9, -0.95, 0.42),
    new THREE.Vector3(0.47, -0.57, 0.39),
  );
  add(new THREE.TubeGeometry(wire, 24, 0.015, 6, false), red, [0, 0, 0]);

  return player;
}

export function mountCassette(canvas: HTMLCanvasElement) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
  } catch {
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 20);
  camera.position.z = 6;
  const label = cassetteLabel();
  const player = buildCassette(label);
  scene.add(player, new THREE.HemisphereLight(0xfff4dd, 0x545560, 2));
  const key = new THREE.DirectionalLight(0xfff0df, 2.4);
  key.position.set(-3, 5, 5);
  scene.add(key);

  player.rotation.set(0.23, -0.42, -0.34);
  const draw = () => renderer.render(scene, camera);
  const resize = new ResizeObserver(() => {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    draw();
  });
  resize.observe(canvas);

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let elapsed = 0;
  let previous: number | undefined;
  let visible = false;
  function render(time: number) {
    if (previous !== undefined) elapsed += Math.min(time - previous, 50) / 1000;
    previous = time;
    player.rotation.y = -0.42 + elapsed * 0.62;
    player.position.y = Math.sin(elapsed * 1.7) * 0.1;
    draw();
  }
  function syncMotion() {
    previous = undefined;
    renderer.setAnimationLoop(visible && !motion.matches ? render : null);
    draw();
  }
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncMotion();
  });
  visibility.observe(canvas);
  motion.addEventListener("change", syncMotion);

  return () => {
    visibility.disconnect();
    resize.disconnect();
    motion.removeEventListener("change", syncMotion);
    renderer.setAnimationLoop(null);
    const materials = new Set<THREE.Material>();
    player.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      materials.add(object.material);
    });
    materials.forEach((surface) => surface.dispose());
    label.dispose();
    renderer.dispose();
  };
}
