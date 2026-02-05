import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/TransformControls.js";
import { STLExporter } from "https://unpkg.com/three@0.160.0/examples/jsm/exporters/STLExporter.js";

const canvasWrap = document.getElementById("canvasWrap");
const statusEl = document.getElementById("status");

// UI
const addButtons = document.querySelectorAll("[data-add]");
const toolMove = document.getElementById("toolMove");
const toolRotate = document.getElementById("toolRotate");
const toolScale = document.getElementById("toolScale");

const snapToggle = document.getElementById("snapToggle");
const snapStep = document.getElementById("snapStep");

const noSelection = document.getElementById("noSelection");
const props = document.getElementById("props");

const objName = document.getElementById("objName");
const sizeX = document.getElementById("sizeX");
const sizeY = document.getElementById("sizeY");
const sizeZ = document.getElementById("sizeZ");
const color = document.getElementById("color");
const deleteBtn = document.getElementById("deleteBtn");
const duplicateBtn = document.getElementById("duplicateBtn");

const exportStlBtn = document.getElementById("exportStlBtn");
const clearBtn = document.getElementById("clearBtn");
const saveJsonBtn = document.getElementById("saveJsonBtn");
const loadJsonBtn = document.getElementById("loadJsonBtn");
const jsonFile = document.getElementById("jsonFile");

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1115);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 5000);
camera.position.set(260, 220, 260);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
canvasWrap.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(200, 350, 200);
scene.add(dir);

// Grid like Tinkercad (units as mm)
const GRID_SIZE = 600;     // mm
const GRID_DIVS = 60;      // 10mm cells if size 600 and divs 60
const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVS, 0x2b3342, 0x202634);
grid.position.y = 0;
scene.add(grid);

// Work plane (raycast target)
const planeGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
const planeMat = new THREE.MeshBasicMaterial({ visible: false });
const workPlane = new THREE.Mesh(planeGeo, planeMat);
workPlane.rotation.x = -Math.PI / 2;
scene.add(workPlane);

// Controls
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.screenSpacePanning = false;

const transform = new TransformControls(camera, renderer.domElement);
transform.setMode("translate");
transform.addEventListener("dragging-changed", (e) => {
  orbit.enabled = !e.value;
});
scene.add(transform);

// Object container (so we can export only models, not grid/controls)
const modelRoot = new THREE.Group();
modelRoot.name = "ModelRoot";
scene.add(modelRoot);

let selected = null;
let selectedBox = null; // helper highlight

// Raycasting for selection
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function setStatus(text) {
  statusEl.textContent = text;
}

function resize() {
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", resize);
resize();

// Helpers: show bounding box on selected
function clearSelectionHelpers() {
  if (selectedBox) {
    scene.remove(selectedBox);
    selectedBox.geometry.dispose();
    selectedBox.material.dispose();
    selectedBox = null;
  }
}

function showSelection(mesh) {
  clearSelectionHelpers();
  if (!mesh) return;

  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const boxMat = new THREE.MeshBasicMaterial({
    wireframe: true,
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.9
  });

  selectedBox = new THREE.Mesh(boxGeo, boxMat);
  selectedBox.position.copy(center);
  scene.add(selectedBox);
}

function updatePropsPanel() {
  const has = !!selected;

  noSelection.classList.toggle("hidden", has);
  props.classList.toggle("hidden", !has);

  if (!has) return;

  objName.value = selected.name || "";

  // Read current size from bounding box (mm)
  const box = new THREE.Box3().setFromObject(selected);
  const sz = new THREE.Vector3();
  box.getSize(sz);

  sizeX.value = (Math.max(sz.x, 0.01)).toFixed(1);
  sizeY.value = (Math.max(sz.y, 0.01)).toFixed(1);
  sizeZ.value = (Math.max(sz.z, 0.01)).toFixed(1);

  const mat = selected.material;
  if (mat && mat.color) {
    color.value = "#" + mat.color.getHexString();
  }
}

function attachTo(mesh) {
  selected = mesh;
  if (mesh) {
    transform.attach(mesh);
    showSelection(mesh);
    setStatus(`Выбран: ${mesh.name || "объект"}`);
  } else {
    transform.detach();
    clearSelectionHelpers();
    setStatus("Ничего не выбрано");
  }
  updatePropsPanel();
}

function makeMaterial(hex = 0xff5533) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.55,
    metalness: 0.05
  });
}

function defaultName(type) {
  const n = modelRoot.children.length + 1;
  const map = {
    box: "Cube",
    sphere: "Sphere",
    cyl: "Cylinder",
    cone: "Cone",
    torus: "Torus"
  };
  return `${map[type] || "Object"}_${n}`;
}

function addPrimitive(type) {
  let geo;
  // default sizes in mm
  if (type === "box") geo = new THREE.BoxGeometry(40, 20, 40);
  if (type === "sphere") geo = new THREE.SphereGeometry(18, 32, 16);
  if (type === "cyl") geo = new THREE.CylinderGeometry(16, 16, 30, 32);
  if (type === "cone") geo = new THREE.ConeGeometry(18, 35, 32);
  if (type === "torus") geo = new THREE.TorusGeometry(18, 6, 18, 48);

  const mesh = new THREE.Mesh(geo, makeMaterial(0xff5533));
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  mesh.position.set(0, 10, 0); // above plane
  mesh.name = defaultName(type);

  // custom metadata: store base type
  mesh.userData.primitive = type;

  modelRoot.add(mesh);
  attachTo(mesh);
}

addButtons.forEach(btn => {
  btn.addEventListener("click", () => addPrimitive(btn.dataset.add));
});

// Selection click
renderer.domElement.addEventListener("pointerdown", (event) => {
  // Ignore clicks on transform gizmo (TransformControls handles)
  // Still, we can select when clicking on mesh
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const objects = modelRoot.children;
  const hits = raycaster.intersectObjects(objects, true);

  if (hits.length > 0) {
    // find top-level mesh (child can be same mesh anyway)
    let mesh = hits[0].object;
    while (mesh && mesh.parent && mesh.parent !== modelRoot) mesh = mesh.parent;
    attachTo(mesh);
  } else {
    attachTo(null);
  }
});

// Tools
function setTool(mode) {
  transform.setMode(mode);
  setStatus(`Инструмент: ${mode}`);
}
toolMove.addEventListener("click", () => setTool("translate"));
toolRotate.addEventListener("click", () => setTool("rotate"));
toolScale.addEventListener("click", () => setTool("scale"));

// Snapping
function applySnap() {
  const enabled = snapToggle.checked;
  const step = Math.max(parseFloat(snapStep.value || "1"), 0.0001);

  if (!enabled) {
    transform.setTranslationSnap(null);
    transform.setRotationSnap(null);
    transform.setScaleSnap(null);
    return;
  }

  transform.setTranslationSnap(step);            // mm
  transform.setRotationSnap(THREE.MathUtils.degToRad(15)); // degrees
  transform.setScaleSnap(0.1);
}
snapToggle.addEventListener("change", applySnap);
snapStep.addEventListener("change", applySnap);
applySnap();

// Update selected box helper when transforming
transform.addEventListener("objectChange", () => {
  if (selected) {
    showSelection(selected);
    updatePropsPanel();
  }
});

// Properties editing
objName.addEventListener("input", () => {
  if (!selected) return;
  selected.name = objName.value.trim();
  setStatus(`Имя: ${selected.name}`);
});

color.addEventListener("input", () => {
  if (!selected) return;
  selected.material.color.set(color.value);
});

function scaleToSize(mesh, targetW, targetH, targetD) {
  // Scale based on current bounding box
  const box = new THREE.Box3().setFromObject(mesh);
  const sz = new THREE.Vector3();
  box.getSize(sz);

  const safe = (v) => Math.max(v, 0.001);
  const sx = safe(targetW) / safe(sz.x);
  const sy = safe(targetH) / safe(sz.y);
  const szc = safe(targetD) / safe(sz.z);

  mesh.scale.multiply(new THREE.Vector3(sx, sy, szc));
}

function parseNum(inputEl, fallback) {
  const v = parseFloat(inputEl.value);
  return Number.isFinite(v) ? v : fallback;
}

function applySizeFromInputs() {
  if (!selected) return;
  const w = parseNum(sizeX, 10);
  const h = parseNum(sizeY, 10);
  const d = parseNum(sizeZ, 10);

  scaleToSize(selected, w, h, d);
  showSelection(selected);
  setStatus(`Размер: ${w.toFixed(1)} x ${h.toFixed(1)} x ${d.toFixed(1)} мм`);
}

[sizeX, sizeY, sizeZ].forEach(el => {
  el.addEventListener("change", applySizeFromInputs);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applySizeFromInputs();
  });
});

// Delete / Duplicate
deleteBtn.addEventListener("click", () => {
  if (!selected) return;
  const toRemove = selected;
  attachTo(null);
  modelRoot.remove(toRemove);
  disposeObject(toRemove);
  setStatus("Удалено");
});

duplicateBtn.addEventListener("click", () => {
  if (!selected) return;
  const clone = selected.clone();
  clone.material = selected.material.clone(); // separate material
  clone.position.x += 20;
  clone.position.z += 20;
  clone.name = (selected.name || "Object") + "_copy";
  modelRoot.add(clone);
  attachTo(clone);
  setStatus("Дубликат создан");
});

// Clear scene
clearBtn.addEventListener("click", () => {
  attachTo(null);
  const children = [...modelRoot.children];
  children.forEach(obj => {
    modelRoot.remove(obj);
    disposeObject(obj);
  });
  setStatus("Сцена очищена");
});

// Export STL
exportStlBtn.addEventListener("click", () => {
  const exporter = new STLExporter();

  // Export only modelRoot content (not grid, not plane)
  const exportGroup = new THREE.Group();
  modelRoot.children.forEach(obj => exportGroup.add(obj.clone(true)));

  const stlString = exporter.parse(exportGroup, { binary: false });
  const blob = new Blob([stlString], { type: "text/plain" });
  downloadBlob(blob, "model.stl");
  setStatus("Экспортировано: model.stl");
});

// Save/Load JSON project
saveJsonBtn.addEventListener("click", () => {
  const json = scene.toJSON();

  // Keep only ModelRoot in JSON (simpler)
  // We’ll store whole scene, but on load we'll extract ModelRoot.
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
  downloadBlob(blob, "project.json");
  setStatus("Сохранено: project.json");
});

loadJsonBtn.addEventListener("click", () => jsonFile.click());

jsonFile.addEventListener("change", async () => {
  const file = jsonFile.files?.[0];
  if (!file) return;

  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    setStatus("Ошибка: не JSON");
    return;
  }

  // Load via ObjectLoader
  const loader = new THREE.ObjectLoader();
  const loadedScene = loader.parse(data);

  // Find ModelRoot
  const loadedRoot = loadedScene.getObjectByName("ModelRoot");
  if (!loadedRoot) {
    setStatus("В JSON не найден ModelRoot");
    return;
  }

  // Clear current modelRoot
  attachTo(null);
  [...modelRoot.children].forEach(obj => {
    modelRoot.remove(obj);
    disposeObject(obj);
  });

  // Move loaded children into current modelRoot
  loadedRoot.children.forEach(child => modelRoot.add(child));

  setStatus("Проект загружен");
  jsonFile.value = "";
});

// Utilities
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
  });
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  renderer.render(scene, camera);
}
animate();
