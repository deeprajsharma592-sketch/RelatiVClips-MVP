import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const DURATION = 5.04;
const AUDIENCES = [
  { label: "Agencies", x: 0, y: 2.43, z: -0.18, start: 0.15 },
  { label: "Teams", x: -3.6, y: 1.74, z: 0.12, start: 0.55 },
  { label: "Developers", x: 3.6, y: 1.74, z: -0.08, start: 0.55 },
  { label: "Creators", x: -4.15, y: 0.03, z: -0.12, start: 1.05 },
  { label: "Brands", x: 4.15, y: 0.03, z: 0.14, start: 1.05 },
  { label: "Entrepreneurs", x: -3.55, y: -1.72, z: 0.08, start: 1.65 },
  { label: "E-commerce", x: 3.55, y: -1.72, z: -0.16, start: 1.65 },
  { label: "SaaS", x: 0, y: -2.45, z: 0.1, start: 2.2 },
] as const;

type Audience = (typeof AUDIENCES)[number];
type Strand = {
  line: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  points: number;
  progressStart: number;
  progress: number;
  web: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[];
};

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function audienceTexture(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 176;
  const context = canvas.getContext("2d");
  if (!context) return null;

  roundedRect(context, 4, 4, 632, 168, 32);
  context.fillStyle = "rgba(7, 8, 12, .94)";
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = "rgba(244, 244, 248, .92)";
  context.stroke();
  context.fillStyle = "#f7f7fb";
  context.font = "600 55px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 320, 88, 570);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function logoTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 200;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.font = "800 150px Inter, Arial, sans-serif";
  context.textBaseline = "middle";
  const first = "Relati";
  const last = "V";
  const triangleWidth = 90;
  const totalWidth = context.measureText(first).width + context.measureText(last).width + triangleWidth + 20;
  let x = (canvas.width - totalWidth) / 2;
  context.fillStyle = "#fafaff";
  context.fillText(first, x, 104);
  x += context.measureText(first).width;
  context.fillStyle = "#ff2c87";
  context.fillText(last, x, 104);
  x += context.measureText(last).width + 20;
  context.beginPath();
  context.moveTo(x, 56);
  context.lineTo(x + triangleWidth, 104);
  context.lineTo(x, 152);
  context.closePath();
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeStrand(
  scene: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  fanOffset: number,
  index: number,
  start: number,
  geometryPool: Set<THREE.BufferGeometry>,
  materialPool: Set<THREE.Material>,
) {
  const direction = new THREE.Vector2(to.x - from.x, to.y - from.y).normalize();
  const tangent = new THREE.Vector3(-direction.y, direction.x, 0);
  const startPoint = from.clone().addScaledVector(tangent, fanOffset * 0.018);
  const endPoint = to.clone().addScaledVector(tangent, fanOffset * 0.11);
  const curve = new THREE.CubicBezierCurve3(
    startPoint,
    startPoint.clone().lerp(endPoint, 0.36).addScaledVector(tangent, fanOffset * 0.1),
    startPoint.clone().lerp(endPoint, 0.76).addScaledVector(tangent, fanOffset * 0.17),
    endPoint,
  );
  const geometry = new THREE.TubeGeometry(curve, 72, index === 2 ? 0.034 : 0.024, 6, false);
  const drawCount = geometry.index?.count ?? geometry.getAttribute("position").count;
  geometry.setDrawRange(0, 0);
  geometryPool.add(geometry);
  const material = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  materialPool.add(material);
  const line = new THREE.Mesh(geometry, material);
  line.renderOrder = 2;
  scene.add(line);

  const web: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[] = [];
  if (index < 4) {
    for (const amount of [0.58, 0.73, 0.86, 0.96]) {
      const point = curve.getPoint(amount);
      const width = (0.1 + amount * 0.12) * Math.sign(fanOffset || 1);
      const other = point.clone().addScaledVector(tangent, width);
      const webGeometry = new THREE.BufferGeometry().setFromPoints([point, other]);
      geometryPool.add(webGeometry);
      const webMaterial = new THREE.LineBasicMaterial({
        color: "#f4f4f8",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      });
      materialPool.add(webMaterial);
      const webLine = new THREE.Line(webGeometry, webMaterial);
      webLine.renderOrder = 1;
      scene.add(webLine);
      web.push(webLine);
    }
  }

  return { line, points: drawCount, progressStart: start, progress: 0, web } satisfies Strand;
}

function audiencePanel(
  audience: Audience,
  texturePool: Set<THREE.Texture>,
  geometryPool: Set<THREE.BufferGeometry>,
  materialPool: Set<THREE.Material>,
) {
  const group = new THREE.Group();
  const width = 2.72;
  const height = 0.75;
  const depth = 0.22;
  const bodyGeometry = new RoundedBoxGeometry(width, height, depth, 5, 0.12);
  geometryPool.add(bodyGeometry);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: "#171922",
    metalness: 0.28,
    roughness: 0.34,
    clearcoat: 0.85,
    transparent: true,
    opacity: 0.9,
  });
  materialPool.add(bodyMaterial);
  group.add(new THREE.Mesh(bodyGeometry, bodyMaterial));

  const texture = audienceTexture(audience.label);
  if (texture) {
    texturePool.add(texture);
    const faceGeometry = new THREE.PlaneGeometry(width - 0.04, height - 0.04);
    geometryPool.add(faceGeometry);
    const faceMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
    materialPool.add(faceMaterial);
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    face.position.z = depth / 2 + 0.004;
    group.add(face);
  }

  group.position.set(audience.x, audience.y, audience.z);
  group.rotation.y = audience.x < 0 ? 0.12 : audience.x > 0 ? -0.12 : 0;
  group.rotation.x = audience.y > 0 ? -0.045 : 0.045;
  return group;
}

export function mountAudienceNetwork(canvas: HTMLCanvasElement, reducedMotion: boolean) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.background = null;
  renderer.setClearColor(0x000000, 0);
  const camera = new THREE.PerspectiveCamera(43, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 11.35);
  camera.lookAt(0, 0, 0);
  const model = new THREE.Group();
  scene.add(model);

  const geometryPool = new Set<THREE.BufferGeometry>();
  const materialPool = new Set<THREE.Material>();
  const texturePool = new Set<THREE.Texture>();

  scene.add(new THREE.AmbientLight(0x9ba4bd, 0.76));
  const keyLight = new THREE.PointLight(0xe7e9ff, 18, 10, 1.7);
  keyLight.position.set(0, 0, 2.5);
  model.add(keyLight);
  const pinkLight = new THREE.PointLight(0xff2c87, 5, 4, 2);
  pinkLight.position.set(0, 0, 1.5);
  model.add(pinkLight);

  const starPositions = new Float32Array(420 * 3);
  let seed = 34;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 420; i++) {
    starPositions[i * 3] = (random() - 0.5) * 17.5;
    starPositions[i * 3 + 1] = (random() - 0.5) * 9.8;
    starPositions[i * 3 + 2] = -1.6 - random() * 4;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  geometryPool.add(starGeometry);
  const starMaterial = new THREE.PointsMaterial({ color: "#d9deee", size: 0.022, transparent: true, opacity: 0.34, depthWrite: false });
  materialPool.add(starMaterial);
  scene.add(new THREE.Points(starGeometry, starMaterial));

  const strands: Strand[] = [];
  const startPoint = new THREE.Vector3(0, 0, -0.2);
  AUDIENCES.forEach((audience, audienceIndex) => {
    model.add(audiencePanel(audience, texturePool, geometryPool, materialPool));
    const destination = new THREE.Vector3(
      audience.x * 0.72,
      audience.y * 0.74,
      audience.z - 0.15,
    );
    const schedule = audience.start;
    for (let strand = 0; strand < 5; strand++) {
      strands.push(
        makeStrand(
          model,
          startPoint,
          destination,
          strand - 2,
          strand,
          schedule,
          geometryPool,
          materialPool,
        ),
      );
    }
    if (audienceIndex === 0) model.position.y = 0;
  });

  const logo = logoTexture();
  if (logo) {
    texturePool.add(logo);
    const logoGeometry = new THREE.PlaneGeometry(2.63, 0.585);
    geometryPool.add(logoGeometry);
    const logoMaterial = new THREE.MeshBasicMaterial({
      map: logo,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
    materialPool.add(logoMaterial);
    const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial);
    logoMesh.position.set(0, 0, 0.36);
    model.add(logoMesh);
  }

  scene.add(new THREE.HemisphereLight(0xe9edff, 0x090a10, 1.1));
  const rimLight = new THREE.DirectionalLight(0xffffff, 2.1);
  rimLight.position.set(-4, 5, 6);
  scene.add(rimLight);

  const updateCamera = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    camera.aspect = aspect;
    camera.position.z = Math.max(11.35, 16.6 / aspect);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  };
  const resize = new ResizeObserver(updateCamera);
  resize.observe(canvas);
  updateCamera();

  let frame = 0;
  let played = false;
  let disposed = false;
  const play = () => {
    if (played || disposed) return;
    played = true;
    if (reducedMotion) {
      strands.forEach((strand) => {
        strand.progress = 1;
        strand.line.geometry.setDrawRange(0, strand.points);
        strand.line.material.opacity = 0.96;
        strand.web.forEach((line) => { line.material.opacity = 0.34; });
      });
      renderer.render(scene, camera);
      return;
    }

    const startTime = performance.now();
    const renderFrame = (now: number) => {
      if (disposed) return;
      const elapsed = Math.min((now - startTime) / 1000, DURATION);
      const normalized = elapsed / DURATION;
      for (const strand of strands) {
        const ramp = Math.min(Math.max((elapsed - strand.progressStart) / 2.48, 0), 1);
        strand.progress = ramp;
        strand.line.geometry.setDrawRange(0, Math.floor(ramp * strand.points));
        strand.line.material.opacity = ramp > 0 ? 0.78 + ramp * 0.2 : 0;
        const webOpacity = Math.min(Math.max((ramp - 0.48) / 0.52, 0), 1) * 0.34;
        strand.web.forEach((line) => { line.material.opacity = webOpacity; });
      }
      model.rotation.y = Math.sin(normalized * Math.PI) * 0.045;
      model.rotation.x = Math.sin(normalized * Math.PI * 2) * 0.016;
      model.position.y = Math.sin(normalized * Math.PI * 2) * 0.035;
      renderer.render(scene, camera);
      if (elapsed < DURATION) frame = requestAnimationFrame(renderFrame);
      else frame = 0;
    };
    frame = requestAnimationFrame(renderFrame);
  };

  const dispose = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resize.disconnect();
    geometryPool.forEach((geometry) => geometry.dispose());
    texturePool.forEach((texture) => texture.dispose());
    materialPool.forEach((material) => material.dispose());
    renderer.dispose();
  };

  return { play, dispose };
}
