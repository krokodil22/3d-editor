(function () {
  const canvasWrap = document.getElementById("canvasWrap");
  const statusEl = document.getElementById("status");
  const errorBox = document.getElementById("errorBox");
  const errorText = document.getElementById("errorText");

  function setStatus(text) { statusEl.textContent = text; }
  function showError(err) {
    errorBox.classList.remove("hidden");
    errorText.textContent = (err && err.stack) ? err.stack : String(err);
    console.error(err);
  }
  window.addEventListener("error", (e) => showError(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => showError(e.reason));

  // Guard: Three.js must be loaded
  if (!window.THREE) {
    showError("THREE не загрузился. Проверь интернет/доступ к unpkg.com.");
    return;
  }
  if (!THREE.OrbitControls || !THREE.TransformControls || !THREE.STLExporter) {
    showError("OrbitControls/TransformControls/STLExporter не загрузились. Проверь доступ к unpkg.com (examples/js).");
    return;
  }

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
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  canvasWrap.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(220, 360, 180);
  scene.add(dir);

  // Grid (mm)
  const GRID_SIZE = 600;
  const GRID_DIVS = 60;
  const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVS, 0x3a4760, 0x242c3c);
  grid.position.y = 0;
  scene.add(grid);

  // Work plane
  const planeGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
  const planeMat = new THREE.MeshBasicMaterial({ visible: false });
  const workPlane = new THREE.Mesh(planeGeo, planeMat);
  workPlane.rotation.x = -Math.PI / 2;
  scene.add(workPlane);

  // Controls
  const orbit = new THREE.OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.target.set(0, 0, 0);
  orbit.update();

  const transform = new THREE.TransformControls(camera, renderer.domElement);
  transform.setMode("translate");
  transform.addEventListener("dragging-changed", (e) => { orbit.enabled = !e.value; });
  scene.add(transform);

  const modelRoot = new THREE.Group();
  modelRoot.name = "ModelRoot";
  scene.add(modelRoot);

  // Selection
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let selected = null;
  let selectedBox = null;

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
      opacity: 0.95,
      depthTest: false
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

    const box = new THREE.Box3().setFromObject(selected);
    const sz = new THREE.Vector3();
    box.getSize(sz);

    sizeX.value = (Math.max(sz.x, 0.01)).toFixed(1);
    sizeY.value = (Math.max(sz.y, 0.01)).toFixed(1);
    sizeZ.value = (Math.max(sz.z, 0.01)).toFixed(1);

    if (selected.material && selected.material.color) {
      color.value = "#" + selected.material.color.getHexString();
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

  function makeMaterial(hex) {
    return new THREE.MeshStandardMaterial({
      color: hex || 0xff5533,
      roughness: 0.55,
      metalness: 0.05
    });
  }

  function defaultName(type) {
    const n = modelRoot.children.length + 1;
    const map = { box: "Cube", sphere: "Sphere", cyl: "Cylinder", cone: "Cone", torus: "Torus" };
    return `${map[type] || "Object"}_${n}`;
  }

  function addPrimitive(type) {
    let geo;
    if (type === "box") geo = new THREE.BoxGeometry(40, 20, 40);
    if (type === "sphere") geo = new THREE.SphereGeometry(18, 32, 16);
    if (type === "cyl") geo = new THREE.CylinderGeometry(16, 16, 30, 32);
    if (type === "cone") geo = new THREE.ConeGeometry(18, 35, 32);
    if (type === "torus") geo = new THREE.TorusGeometry(18, 6, 18, 48);

    const mesh = new THREE.Mesh(geo, makeMaterial(0xff5533));
    mesh.position.set(0, 10, 0);
    mesh.name = defaultName(type);
    mesh.userData.primitive = type;

    modelRoot.add(mesh);
    attachTo(mesh);
  }

  addButtons.forEach(btn => btn.addEventListener("click", () => addPrimitive(btn.dataset.add)));

  renderer.domElement.addEventListener("pointerdown", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(modelRoot.children, true);

    if (hits.length > 0) {
      let mesh = hits[0].object;
      while (mesh && mesh.parent && mesh.parent !== modelRoot) mesh = mesh.parent;
      attachTo(mesh);
    } else {
      attachTo(null);
    }
  });

  function setTool(mode) { transform.setMode(mode); setStatus(`Инструмент: ${mode}`); }
  toolMove.addEventListener("click", () => setTool("translate"));
  toolRotate.addEventListener("click", () => setTool("rotate"));
  toolScale.addEventListener("click", () => setTool("scale"));

  function applySnap() {
    const enabled = snapToggle.checked;
    const step = Math.max(parseFloat(snapStep.value || "1"), 0.0001);
    if (!enabled) {
      transform.setTranslationSnap(null);
      transform.setRotationSnap(null);
      transform.setScaleSnap(null);
      return;
    }
    transform.setTranslationSnap(step);
    transform.setRotationSnap(THREE.MathUtils.degToRad(15));
    transform.setScaleSnap(0.1);
  }
  snapToggle.addEventListener("change", applySnap);
  snapStep.addEventListener("change", applySnap);
  applySnap();

  transform.addEventListener("objectChange", () => {
    if (selected) { showSelection(selected); updatePropsPanel(); }
  });

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
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") applySizeFromInputs(); });
  });

  function disposeObject(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }

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
    clone.material = selected.material.clone();
    clone.position.x += 20;
    clone.position.z += 20;
    clone.name = (selected.name || "Object") + "_copy";
    modelRoot.add(clone);
    attachTo(clone);
    setStatus("Дубликат создан");
  });

  clearBtn.addEventListener("click", () => {
    attachTo(null);
    [...modelRoot.children].forEach(obj => {
      modelRoot.remove(obj);
      disposeObject(obj);
    });
    setStatus("Сцена очищена");
  });

  exportStlBtn.addEventListener("click", () => {
    const exporter = new THREE.STLExporter();
    const exportGroup = new THREE.Group();
    modelRoot.children.forEach(obj => exportGroup.add(obj.clone(true)));
    const stlString = exporter.parse(exportGroup, { binary: false });
    const blob = new Blob([stlString], { type: "text/plain" });
    downloadBlob(blob, "model.stl");
    setStatus("Экспортировано: model.stl");
  });

  saveJsonBtn.addEventListener("click", () => {
    // Serialize only modelRoot children (simple custom format)
    const data = modelRoot.children.map(obj => ({
      name: obj.name,
      primitive: obj.userData.primitive || "custom",
      position: obj.position.toArray(),
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: obj.scale.toArray(),
      color: obj.material && obj.material.color ? "#" + obj.material.color.getHexString() : "#ff5533"
    }));
    const blob = new Blob([JSON.stringify({ version: 1, objects: data }, null, 2)], { type: "application/json" });
    downloadBlob(blob, "project.json");
    setStatus("Сохранено: project.json");
  });

  loadJsonBtn.addEventListener("click", () => jsonFile.click());

  jsonFile.addEventListener("change", async () => {
    const file = jsonFile.files && jsonFile.files[0];
    if (!file) return;
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { setStatus("Ошибка: не JSON"); return; }

    if (!data || !Array.isArray(data.objects)) { setStatus("Неверный формат project.json"); return; }

    attachTo(null);
    [...modelRoot.children].forEach(obj => { modelRoot.remove(obj); disposeObject(obj); });

    data.objects.forEach(o => {
      addPrimitive(o.primitive);
      const obj = modelRoot.children[modelRoot.children.length - 1];
      obj.name = o.name || obj.name;
      obj.position.fromArray(o.position || [0,10,0]);
      if (o.rotation) obj.rotation.set(o.rotation[0], o.rotation[1], o.rotation[2]);
      if (o.scale) obj.scale.fromArray(o.scale);
      if (o.color) obj.material.color.set(o.color);
    });

    attachTo(null);
    setStatus("Проект загружен");
    jsonFile.value = "";
  });

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

  function resize() {
    const w = canvasWrap.clientWidth || (window.innerWidth - 320);
    const h = canvasWrap.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener("resize", resize);
  requestAnimationFrame(() => { resize(); setStatus("Готово (сетка видна)"); });

  function animate() {
    requestAnimationFrame(animate);
    orbit.update();
    renderer.render(scene, camera);
  }
  animate();
})();