import * as THREE from "three";
import { cookPhase, customerPhase } from "./game.js";
import { kitchenViewport } from "./game-layout.js";

const C = {
  cream: 0xf2dfb8,
  green: 0x3c7964,
  dark: 0x204f45,
  mint: 0xa4b9a0,
  red: 0xc75e46,
  gold: 0xf0c875,
  steel: 0xbac7bb,
  wood: 0xb28755,
  skin: 0xd4a077,
  black: 0x363a31,
  white: 0xfff4dc,
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (a, b, dt, speed = 7) =>
  THREE.MathUtils.lerp(a, b, 1 - Math.exp(-dt * speed));

export class StallScene {
  constructor(
    container,
    { onProject, onHover, onDrop, onPick, onLift, accepts, onCamera },
  ) {
    this.container = container;
    this.callbacks = {
      onProject,
      onHover,
      onDrop,
      onPick,
      onLift,
      accepts,
      onCamera,
    };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc5d3b6);
    this.scene.fog = new THREE.Fog(0xdacfb1, 22, 52);
    this.camera = new THREE.PerspectiveCamera(49, 1, 0.1, 85);
    this.ticketCamera = this.camera.clone();
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D hawker stall. Drag ingredients into equipment, then drag finished dishes to customers. Use A and D to look around.",
    );
    this.renderer.domElement.tabIndex = 0;
    this.backdrop = document.createElement("canvas");
    this.backdrop.className = "world-backdrop";
    this.backdrop.setAttribute("aria-hidden", "true");
    this.backdropContext = this.backdrop.getContext("2d", { alpha: false });
    container.before(this.backdrop);
    container.append(this.renderer.domElement);
    this.materials = new Map();
    this.objects = new Map();
    this.customers = new Map();
    this.dishes = new Map();
    this.baskets = new Map();
    this.cookRings = new Map();
    this.dropRings = [];
    this.fans = [];
    this.pedestrians = [];
    this.steam = [];
    this.clock = 0;
    this.view = 0;
    this.viewCurrent = 0;
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.drag = null;
    this.held = null;
    this.stateKey = "";
    this.buildLights();
    this.buildCentre();
    this.buildKitchen();
    this.renderer.domElement.dataset.pov = "first-person";
    this.renderer.domElement.dataset.view = "centre";
    this.halo = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.48, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffd976,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.renderOrder = 8;
    this.halo.visible = false;
    this.scene.add(this.halo);
    this.boundResize = () => this.resize();
    window.addEventListener("resize", this.boundResize);
    this.resize();
    this.bindPointer();
  }
  material(color) {
    if (!this.materials.has(color))
      this.materials.set(
        color,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.85,
          flatShading: true,
        }),
      );
    return this.materials.get(color);
  }
  group(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
  box(parent, w, h, d, color, x = 0, y = 0, z = 0, radius = 0) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  cylinder(
    parent,
    top,
    bottom,
    height,
    color,
    x = 0,
    y = 0,
    z = 0,
    sides = 24,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(top, bottom, height, sides),
      this.material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  ball(parent, radius, color, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 8),
      this.material(color),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  text(
    parent,
    text,
    w,
    h,
    x,
    y,
    z,
    { bg = "#234e40", color = "#ffe9b6", size = 40, rotate = 0 } = {},
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 768, 128);
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 384, 67, 730);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });
    mat.userData.local = true;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotate;
    parent.add(mesh);
    return mesh;
  }
  register(name, group, info, anchor = [0, 0.2, 0]) {
    group.userData.interaction = { ...info, name };
    group.userData.anchor = V(...anchor);
    group.updateWorldMatrix(true, true);
    group.userData.pickup =
      info.kind === "customer"
        ? V(0, 1.48, 0)
        : group.worldToLocal(
            new THREE.Box3().setFromObject(group).getCenter(V(0, 0, 0)),
          );
    this.objects.set(name, group);
    return group;
  }
  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xffedcc, 0x607f68, 2.4));
    const sun = new THREE.DirectionalLight(0xffe3af, 3.2);
    sun.position.set(-8, 16, 4);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, {
      left: -16,
      right: 16,
      top: 13,
      bottom: -20,
      near: 1,
      far: 55,
    });
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xd0e6db, 1.1);
    fill.position.set(8, 6, -9);
    this.scene.add(fill);
  }
  tiledFloor() {
    const geom = new THREE.BoxGeometry(0.98, 0.045, 0.98);
    const colours = [0xc5c6ad, 0xd8d4b7, 0xb7bfa6];
    colours.forEach((color, idx) => {
      const coords = [];
      for (let x = -18; x < 18; x++)
        for (let z = -32; z < 8; z++)
          if ((x + z + 100) % 3 === idx) coords.push([x, z]);
      const tiles = new THREE.InstancedMesh(
          geom,
          this.material(color),
          coords.length,
        ),
        matrix = new THREE.Matrix4();
      coords.forEach(([x, z], i) => {
        matrix.makeTranslation(x, -0.025, z);
        tiles.setMatrixAt(i, matrix);
      });
      tiles.receiveShadow = true;
      this.scene.add(tiles);
    });
  }
  plant(parent, x, z, scale = 1) {
    const p = this.group(parent, x, 0, z);
    p.scale.setScalar(scale);
    this.cylinder(p, 0.38, 0.28, 0.65, 0x9a7655, 0, 0.32, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const leaf = this.ball(
        p,
        0.42,
        i % 2 ? 0x789365 : 0x547c59,
        Math.sin(a) * 0.27,
        0.9 + (i % 2) * 0.3,
        Math.cos(a) * 0.27,
      );
      leaf.scale.set(0.5, 1.6, 0.55);
      leaf.rotation.z = Math.sin(a) * 0.5;
    }
  }
  table(x, z, color = C.red) {
    const g = this.group(this.scene, x, 0, z);
    this.cylinder(g, 1.05, 1.05, 0.13, 0xe2dac0, 0, 1.1, 0, 32);
    this.cylinder(g, 0.13, 0.25, 1.05, 0xa8aea1, 0, 0.52, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        sx = Math.sin(a) * 1.55,
        sz = Math.cos(a) * 1.55;
      this.cylinder(g, 0.35, 0.35, 0.12, color, sx, 0.58, sz, 16);
      for (const dx of [-0.18, 0.18])
        for (const dz of [-0.18, 0.18])
          this.box(g, 0.055, 0.54, 0.055, color, sx + dx, 0.27, sz + dz);
    }
    this.cylinder(g, 0.1, 0.12, 0.2, C.red, 0.32, 1.25, 0.15);
    this.box(g, 0.27, 0.17, 0.22, C.cream, -0.23, 1.25, 0.05);
  }
  backgroundStall(x, z, name, color, number) {
    const g = this.group(this.scene, x, 0, z);
    this.box(g, 5.4, 3.8, 1, 0xd7c5a1, 0, 1.9, -0.8);
    this.box(g, 5, 2.45, 0.12, 0x707b67, 0, 1.7, -0.2);
    this.box(g, 5.5, 1.1, 1.4, color, 0, 0.55, 0.2);
    this.box(g, 5.7, 0.13, 1.6, C.steel, 0, 1.16, 0.2);
    this.box(g, 5.6, 0.7, 0.23, color, 0, 3.5, 0.1);
    this.text(g, name, 5.1, 0.55, 0, 3.5, 0.23, {
      bg: `#${color.toString(16).padStart(6, "0")}`,
      size: 44,
    });
    this.text(g, `#01-${number}  ·  FRESH DAILY`, 2.3, 0.23, 0, 3, -0.12, {
      bg: "#e2d4af",
      color: "#5b694f",
      size: 34,
    });
    for (let i = 0; i < 10; i++)
      this.box(
        g,
        0.55,
        0.18,
        1.15,
        i % 2 ? C.cream : color,
        -2.47 + i * 0.55,
        3.14,
        0.55,
      );
    for (let i = 0; i < 4; i++) {
      this.cylinder(g, 0.19, 0.22, 0.3, C.steel, -1.5 + i, 1.39, 0.13);
      this.box(g, 0.6, 0.09, 0.55, C.wood, -1.5 + i, 2.25, -0.05);
    }
  }
  buildCentre() {
    this.tiledFloor();
    // The aisle is left open so approaching customers read clearly against the dining hall.
    for (const [x, z] of [
      [-7, -7],
      [7, -7],
      [-4.7, -13],
      [4.7, -13],
      [-9, -18],
      [0, -19],
      [9, -18],
    ])
      this.table(x, z, z < -12 ? C.green : C.red);
    this.backgroundStall(-9, -26, "TIAN TIAN  ·  CHICKEN RICE", 0x477d65, "12");
    this.backgroundStall(-3, -26, "老字号  ·  TEH & KOPI", 0xb46445, "13");
    this.backgroundStall(3, -26, "FRESH SUGAR CANE  甘蔗", 0x7d9964, "14");
    this.backgroundStall(9, -26, "NASI LEMAK  ·  SEDAP!", 0xa88945, "15");
    for (let x = -15; x <= 15; x += 10) {
      this.box(this.scene, 0.52, 7.4, 0.52, 0xc3c1a0, x, 3.7, -17);
      this.box(this.scene, 0.75, 0.12, 0.75, C.green, x, 2.2, -17);
      this.plant(this.scene, x + 0.75, -17, 1.2);
    }
    this.box(this.scene, 35, 0.3, 20, 0xc8c5a5, 0, 7.4, -17);
    for (let z = -26; z < -6; z += 6) {
      this.box(this.scene, 35, 0.28, 0.24, 0xa3a58d, 0, 7.1, z);
      for (let x = -10; x <= 10; x += 10) this.fan(x, 6.5, z + 2);
    }
    for (let x = -18; x <= 18; x += 3) {
      this.box(this.scene, 0.16, 0.16, 24, 0xadae92, x, 7.05, -17);
    }
    this.text(
      this.scene,
      "TIONG BAHRU MARKET   ·   中峇鲁巴刹",
      11,
      0.8,
      0,
      5.8,
      -25.3,
      { bg: "#d9c9a3", color: "#476b55", size: 43 },
    );
    for (const x of [-17, 17]) {
      this.box(this.scene, 0.4, 1, 34, 0x96ad88, x, 0.5, -12);
      for (let z = -25; z < -3; z += 4) this.plant(this.scene, x, z, 2);
    }
    for (let i = 0; i < 8; i++) {
      const p = this.person(["office", "regular", "family"][i % 3]);
      p.position.set(-10 + i * 2.8, 0, -9 - (i % 3) * 5);
      p.scale.setScalar(0.9);
      this.scene.add(p);
      this.pedestrians.push({
        group: p,
        origin: p.position.clone(),
        speed: 0.2 + i * 0.025,
        phase: i * 2,
      });
    }
  }
  fan(x, y, z) {
    this.cylinder(this.scene, 0.035, 0.035, 0.8, C.dark, x, y + 0.4, z);
    const g = this.group(this.scene, x, y, z);
    this.cylinder(g, 0.18, 0.2, 0.17, C.dark);
    for (let i = 0; i < 3; i++) {
      const blade = this.group(g);
      blade.rotation.y = (i * Math.PI * 2) / 3;
      const b = this.box(blade, 0.3, 0.035, 1.4, 0x526f59, 0, 0, 0.65);
      b.rotation.y = 0.2;
    }
    this.fans.push(g);
  }
  counter(x, z, w, d) {
    const g = this.group(this.scene, x, 0, z);
    this.box(g, w, 1.15, d, C.green, 0, 0.6, 0);
    this.box(g, w + 0.12, 0.12, d + 0.12, C.steel, 0, 1.23, 0);
    for (let i = 0; i < Math.ceil(w / 0.4); i++) {
      const tx = -w / 2 + i * 0.4 + 0.2;
      this.box(g, 0.015, 0.9, 0.008, 0x6d9b7c, tx, 0.6, d / 2 + 0.005);
    }
    for (const ty of [0.35, 0.75])
      this.box(g, w, 0.012, 0.008, 0x6d9b7c, 0, ty, d / 2 + 0.005);
    this.box(g, w + 0.12, 0.045, 0.04, 0xe7d6ae, 0, 1.12, d / 2 + 0.06);
  }
  buildKitchen() {
    // An open U counter gives the camera three genuinely different work areas.
    this.counter(0, -1.1, 8.6, 1.35);
    this.counter(-3.7, 1.4, 1.6, 4.6);
    this.counter(3.7, 1.4, 1.6, 4.6);
    for (const x of [-4.65, 4.65]) {
      this.box(this.scene, 0.12, 3.4, 4.8, 0xddd5b6, x, 1.7, 1.35);
      this.box(this.scene, 0.14, 1.35, 4.8, C.green, x, 0.675, 1.35);
      for (let z = -0.9; z < 3.8; z += 0.45)
        this.box(
          this.scene,
          0.015,
          1.95,
          0.015,
          0xc7c7a7,
          x + (x < 0 ? 0.075 : -0.075),
          2.3,
          z,
        );
    }
    this.text(this.scene, "PREP & COOK", 2.8, 0.32, -4.54, 3.12, 1.3, {
      rotate: Math.PI / 2,
    });
    this.text(this.scene, "KOPI & TAKEAWAY", 2.8, 0.32, 4.54, 2.78, 1.3, {
      rotate: -Math.PI / 2,
    });
    for (const x of [-4.8, 4.8]) {
      this.box(this.scene, 0.18, 4.5, 0.18, C.dark, x, 2.25, -1.7);
    }
    this.box(this.scene, 9.8, 0.75, 0.25, C.dark, 0, 4.2, -1.75);
    this.text(
      this.scene,
      "AH HUAT’S   亚发   ·   HANDMADE HAPPINESS",
      8.8,
      0.52,
      0,
      4.2,
      -1.6,
      { size: 42 },
    );
    for (let i = 0; i < 20; i++) {
      const stripe = this.box(
        this.scene,
        0.49,
        0.1,
        1,
        i % 2 ? C.cream : C.red,
        -4.65 + i * 0.49,
        3.73,
        -1.5,
      );
      stripe.rotation.x = 0.08;
      const scallop = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.245,
          0.245,
          0.05,
          16,
          1,
          false,
          -Math.PI / 2,
          Math.PI,
        ),
        this.material(i % 2 ? C.cream : C.red),
      );
      scallop.rotation.x = Math.PI / 2;
      scallop.position.set(-4.65 + i * 0.49, 3.73, -1);
      this.scene.add(scallop);
    }
    this.text(this.scene, "01–08", 0.72, 0.3, 4.05, 3.95, -1.56, {
      bg: "#d7bd85",
      color: "#375d46",
      size: 53,
    });
    // Raised stock shelf: ingredients have their own row, clear of the worktop.
    const pantry = this.group(this.scene, -4.02, 1.95, 1.75);
    this.box(pantry, 1.02, 0.1, 3.35, C.wood);
    this.box(pantry, 0.06, 0.42, 3.35, C.green, -0.49, 0.23, 0);
    for (const z of [-1.68, 1.68]) {
      this.box(pantry, 0.08, 0.67, 0.08, C.dark, -0.43, -0.31, z);
      this.box(pantry, 0.95, 0.16, 0.06, C.wood, 0, 0.09, z);
    }
    for (const [label, z] of [
      ["BREAD", 2.85],
      ["MEE NESTS", 1.75],
      ["FRESH GREENS", 0.65],
    ])
      this.text(this.scene, label, 0.84, 0.16, -3.49, 1.9, z, {
        rotate: Math.PI / 2,
        bg: "#e5d1a0",
        color: "#435d40",
        size: 35,
      });
    const noodleTray = this.group(this.scene, -4.02, 2.03, 1.75);
    this.box(noodleTray, 1, 0.1, 0.7, C.wood, 0, 0, 0);
    for (let i = 0; i < 3; i++)
      this.noodleNest(noodleTray, -0.28 + i * 0.28, 0.08, 0, 0.23);
    this.register("noodles", noodleTray, {
      kind: "ingredient",
      item: "noodles",
      label: "Mee nests · drag into the pot",
      draggable: true,
    });
    const breadTray = this.group(this.scene, -4.02, 2.03, 2.85);
    this.box(breadTray, 0.95, 0.06, 0.65, C.wood);
    for (let i = 0; i < 3; i++)
      this.bread(breadTray, 0, 0.07 + i * 0.08, 0, false);
    this.register("bread", breadTray, {
      kind: "ingredient",
      item: "bread",
      label: "Bread · drag onto the shared grill",
      draggable: true,
    });
    const stove = this.group(this.scene, -3.45, 1.32, -0.9);
    this.box(stove, 1.5, 0.17, 1, 0x697e71);
    this.cylinder(stove, 0.51, 0.51, 0.08, C.black, -0.24, 0.12, 0);
    this.box(stove, 0.44, 0.06, 0.67, C.black, 0.48, 0.12, 0);
    const pot = this.group(stove, -0.24, 0.19, 0);
    this.pot(pot);
    this.register(
      "pot",
      pot,
      { kind: "pot", slot: 0, label: "Noodle pot · shared burner" },
      [0, 0.35, 0],
    );
    const grill = this.group(this.scene, -3.7, 1.38, 0.25);
    this.box(grill, 1.08, 0.12, 0.66, 0x596359);
    for (let i = 0; i < 7; i++)
      this.box(grill, 0.045, 0.025, 0.61, 0x9c9e82, -0.42 + i * 0.14, 0.075, 0);
    this.register("grill", grill, {
      kind: "grill",
      label: "Toast grill · shares the burner",
    });
    const toolRack = this.group(this.scene, -4.15, 2.53, -0.07);
    this.box(toolRack, 0.09, 0.85, 1.28, C.dark);
    this.box(toolRack, 0.12, 0.08, 1.32, C.wood, 0, -0.42, 0);
    const knife = this.group(this.scene, -4.02, 2.4, 0.29);
    this.box(knife, 0.045, 0.45, 0.17, C.steel, 0, 0, 0);
    this.box(knife, 0.075, 0.29, 0.13, C.wood, 0, 0.35, 0);
    this.kayaOnKnife = this.box(knife, 0.025, 0.28, 0.15, 0x96a95b, 0.03, 0, 0);
    this.kayaOnKnife.name = "kaya-on-knife";
    this.kayaOnKnife.visible = false;
    this.register("knife", knife, {
      kind: "ingredient",
      item: "knife",
      label: "Kaya spreader · dip into the kaya jar, then spread on toast",
      draggable: true,
    });
    for (let i = 0; i < 3; i++) {
      const spot = this.group(this.scene, -1.1 + i * 1.1, 1.315, -0.75);
      this.cylinder(spot, 0.48, 0.48, 0.025, 0x889b7c);
      this.cylinder(spot, 0.42, 0.42, 0.03, 0xd4d7bd, 0, 0.01, 0);
      this.register(
        `spot-${i}`,
        spot,
        {
          kind: "plating",
          slot: i,
          label: "Empty bowl · drag a ready basket here",
        },
        [0, 0.18, 0],
      );
    }
    const tray = this.group(this.scene, -1.35, 1.34, -1.52);
    this.box(tray, 1.15, 0.035, 0.46, 0x859a83);
    this.register("prep", tray, {
      kind: "prep",
      label: "Prepared food · drag a portion into an empty bowl",
    });
    const chilli = this.group(this.scene, -3.12, 1.34, 2.22);
    this.ramekin(chilli, C.red);
    this.cylinder(chilli, 0.22, 0.24, 0.06, 0xa8452b, 0, 0.16, 0);
    this.register("chilli", chilli, {
      kind: "ingredient",
      item: "chilli",
      label: "Sambal chilli · drag onto a plated bowl",
      draggable: true,
    });
    const garnish = this.group(this.scene, -2.99, 1.34, 0.3);
    this.ramekin(garnish, 0x698d4c);
    for (let i = 0; i < 9; i++)
      this.box(
        garnish,
        0.045,
        0.08,
        0.035,
        0x709c43,
        ((i % 3) - 1) * 0.1,
        0.19,
        Math.floor(i / 3) * 0.08 - 0.08,
      );
    this.register("garnish", garnish, {
      kind: "ingredient",
      item: "garnish",
      label: "Chopped greens · chop a batch on the board first",
      draggable: false,
    });
    this.choppedGreens = garnish;
    const vegetables = this.group(this.scene, -4.02, 2.06, 0.65);
    this.greens(vegetables);
    this.register("vegetables", vegetables, {
      kind: "ingredient",
      item: "vegetables",
      label: "Fresh greens · drag to the chopping board",
      draggable: true,
    });
    this.board = this.group(this.scene, -3.12, 1.36, 1.27);
    this.box(this.board, 1.05, 0.05, 0.9, C.wood);
    this.register("board", this.board, {
      kind: "board",
      label: "Chopping board · load greens, then chop three times",
    });
    this.boardFood = this.group(this.board, 0, 0.04, 0);
    const cleaver = this.group(this.scene, -4.01, 2.4, -0.44);
    this.box(cleaver, 0.065, 0.38, 0.43, C.steel, 0, 0, -0.07);
    this.box(cleaver, 0.09, 0.29, 0.14, 0x845332, 0, 0.33, 0.04);
    for (const y of [0.24, 0.4])
      this.ball(cleaver, 0.025, C.gold, 0.055, y, 0.04);
    for (const [label, z] of [
      ["CLEAVER", -0.44],
      ["KAYA KNIFE", 0.29],
    ])
      this.text(this.scene, label, 0.58, 0.14, -3.98, 2.15, z, {
        rotate: Math.PI / 2,
        bg: "#e5d1a0",
        color: "#435d40",
        size: 35,
      });
    this.cleaverGlow = this.box(
      toolRack,
      0.015,
      0.73,
      0.58,
      C.gold,
      0.07,
      0,
      -0.37,
    );
    this.cleaverGlow.material = new THREE.MeshBasicMaterial({
      color: C.gold,
      transparent: true,
      opacity: 0.2,
    });
    this.cleaverGlow.visible = false;
    this.register("cleaver", cleaver, {
      kind: "ingredient",
      item: "cleaver",
      label: "Cleaver · pick up, then tap the loaded board three times",
      draggable: true,
    });
    const kaya = this.group(this.scene, -3.12, 1.35, 3.05);
    this.cylinder(kaya, 0.23, 0.2, 0.31, 0xd8cba0, 0, 0.16, 0);
    this.cylinder(kaya, 0.21, 0.21, 0.025, 0x93a258, 0, 0.325, 0);
    this.text(kaya, "KAYA", 0.3, 0.14, 0.225, 0.17, 0, {
      bg: "#e6d5a3",
      color: "#4e693f",
      rotate: Math.PI / 2,
      size: 50,
    });
    this.register("kaya", kaya, {
      kind: "ingredient",
      item: "kaya",
      label: "Kaya jar · dip the spreader here",
    });
    const bags = this.group(this.scene, 3.72, 1.34, -0.7);
    for (let i = 0; i < 4; i++)
      this.box(bags, 0.65, 0.025, 0.52, 0xb69058, 0, i * 0.035, 0);
    this.register("takeaway", bags, {
      kind: "ingredient",
      item: "takeaway",
      label: "Takeaway paper · drag onto a plated dish",
      draggable: true,
    });
    const milk = this.group(this.scene, 3.75, 1.35, -0.05);
    this.box(milk, 0.35, 0.45, 0.32, C.white, 0, 0.23, 0);
    this.box(milk, 0.35, 0.14, 0.32, 0x87aab1, 0, 0.52, 0);
    this.text(milk, "MILK", 0.3, 0.15, -0.181, 0.27, 0, {
      bg: "#f3ead0",
      color: "#4c7d85",
      rotate: -Math.PI / 2,
      size: 50,
    });
    this.register("milk", milk, {
      kind: "ingredient",
      item: "milk",
      label: "Milk · drag into a cup of black coffee",
      draggable: true,
    });
    const sugar = this.group(this.scene, 3.65, 1.35, 0.54);
    this.ramekin(sugar, C.white);
    this.box(sugar, 0.05, 0.025, 0.35, C.steel, -0.05, 0.22, 0.18);
    this.register("sugar", sugar, {
      kind: "ingredient",
      item: "sugar",
      label: "Sugar · one spoon, only if ordered",
      draggable: true,
    });
    const coffee = this.group(this.scene, 3.7, 1.35, 1.3);
    this.cylinder(coffee, 0.38, 0.43, 0.75, 0x627b6b, 0, 0.38, 0);
    this.cylinder(coffee, 0.44, 0.4, 0.12, C.steel, 0, 0.79, 0);
    this.ball(coffee, 0.08, C.black, 0, 0.9, 0);
    this.box(coffee, 0.12, 0.12, 0.28, C.black, 0, 0.42, 0.48);
    this.cylinder(coffee, 0.22, 0.27, 0.04, C.steel, 0, -0.01, 0);
    this.text(coffee, "KOPI", 0.47, 0.18, 0, 0.42, 0.385, {
      bg: "#dcd2aa",
      color: "#43614d",
      size: 55,
    });
    this.register(
      "coffee",
      coffee,
      { kind: "coffee", label: "Kopi urn · drop a cup here to pour" },
      [0, 0.45, 0.1],
    );
    this.pourDisplay = this.group(this.scene, 3.7, 1.32, 1.89);
    this.cup(this.pourDisplay, 0, 0, 0, true);
    this.cylinder(this.pourDisplay, 0.018, 0.018, 0.18, 0x68462c, 0, 0.37, 0);
    this.pourDisplay.visible = false;
    const cups = this.group(this.scene, 3.7, 1.35, 3.0);
    for (let i = 0; i < 3; i++) this.cup(cups, (i - 1) * 0.29, 0, 0);
    this.register("cup", cups, {
      kind: "ingredient",
      item: "cup",
      label: "Empty cup · drag to the kopi urn",
      draggable: true,
    });
    const kettle = this.group(this.scene, 4.2, 1.38, 2.25);
    this.cylinder(kettle, 0.26, 0.3, 0.44, C.steel, 0, 0.2, 0);
    this.ball(kettle, 0.1, C.black, 0, 0.5, 0);
    const spout = this.cylinder(kettle, 0.06, 0.1, 0.3, C.steel, -0.35, 0.3, 0);
    spout.rotation.z = -0.8;
    this.register("kettle", kettle, {
      kind: "ingredient",
      item: "kettle",
      label: "Fresh brew · drag to the kopi urn to refill",
      draggable: true,
    });
    const bin = this.group(this.scene, -2.55, 0.65, 2.85);
    this.cylinder(bin, 0.36, 0.3, 0.75, 0x6c846f, 0, 0.4, 0);
    this.cylinder(bin, 0.41, 0.39, 0.06, 0x4c6759, 0, 0.8, 0);
    this.text(bin, "BIN", 0.35, 0.18, 0, 0.45, 0.35, {
      bg: "#6c846f",
      color: "#e6e4ba",
      size: 53,
    });
    this.register(
      "bin",
      bin,
      { kind: "bin", label: "Bin · discard burnt food or unwanted dishes" },
      [0, 0.55, 0],
    );
    this.text(this.scene, "BAK CHOR MEE   $5.50", 1.7, 0.3, -3.6, 2.2, -1.62, {
      bg: "#f0d9a7",
      color: "#43614d",
      size: 42,
    });
    this.text(
      this.scene,
      "KOPI  $1.80   ·   KAYA TOAST  $3.20",
      2.15,
      0.3,
      3.5,
      2.2,
      -1.62,
      { bg: "#f0d9a7", color: "#43614d", size: 35 },
    );
    this.fan(-2, 4.1, 2.9);
    for (let i = 0; i < 14; i++) {
      const m = this.ball(this.scene, 0.055, 0xf5e8cb);
      m.material = new THREE.MeshBasicMaterial({
        color: 0xfff2d2,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });
      m.visible = false;
      this.steam.push(m);
    }
  }
  pot(parent) {
    this.cylinder(parent, 0.47, 0.42, 0.4, C.steel, 0, 0.2, 0);
    this.cylinder(parent, 0.44, 0.44, 0.025, 0x739887, 0, 0.41, 0);
    this.cylinder(parent, 0.48, 0.48, 0.025, 0xd5deca, 0, 0.43, 0);
    this.cylinder(parent, 0.41, 0.41, 0.028, 0x769d8c, 0, 0.446, 0);
    for (const x of [-0.56, 0.56])
      this.box(parent, 0.2, 0.06, 0.12, C.black, x, 0.28, 0);
  }
  ramekin(parent, color) {
    this.cylinder(parent, 0.27, 0.2, 0.16, C.cream, 0, 0.08, 0);
    this.cylinder(parent, 0.235, 0.235, 0.025, color, 0, 0.17, 0);
  }
  noodleNest(parent, x = 0, y = 0, z = 0, r = 0.27) {
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r - i * 0.045, 0.025, 5, 18),
        this.material(C.gold),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y + i * 0.012, z);
      parent.add(ring);
    }
  }
  bread(parent, x = 0, y = 0, z = 0, kaya = false) {
    this.box(parent, 0.53, 0.09, 0.5, 0xbf8245, x, y, z);
    this.box(
      parent,
      0.44,
      0.025,
      0.41,
      kaya ? 0xa4ac62 : 0xf1d899,
      x,
      y + 0.057,
      z,
    );
    if (kaya)
      this.box(
        parent,
        0.18,
        0.035,
        0.12,
        0xf4dc8a,
        x + 0.04,
        y + 0.083,
        z - 0.03,
      );
  }
  greens(parent, chopped = false, count = 5) {
    for (let i = 0; i < count; i++) {
      if (chopped)
        this.box(
          parent,
          0.07,
          0.045,
          0.09,
          0x68984d,
          ((i % 3) - 1) * 0.11,
          0.045,
          Math.floor(i / 3) * 0.12 - 0.12,
        );
      else {
        const leaf = this.ball(
          parent,
          0.15,
          i % 2 ? 0x719b4c : 0x98b16c,
          ((i % 3) - 1) * 0.12,
          0.1,
          Math.floor(i / 3) * 0.13 - 0.05,
        );
        leaf.scale.set(0.65, 0.38, 1.5);
        this.box(
          parent,
          0.04,
          0.035,
          0.22,
          0xd2dba2,
          ((i % 3) - 1) * 0.12,
          0.09,
          0.07,
        );
      }
    }
  }
  cup(parent, x = 0, y = 0, z = 0, full = false) {
    this.cylinder(parent, 0.15, 0.12, 0.27, C.white, x, y + 0.14, z);
    this.cylinder(
      parent,
      0.13,
      0.13,
      0.02,
      full ? 0x6b4429 : 0xd3d0b1,
      x,
      y + 0.28,
      z,
    );
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.095, 0.025, 6, 12),
      this.material(C.white),
    );
    handle.position.set(x + 0.16, y + 0.15, z);
    parent.add(handle);
    this.cylinder(parent, 0.23, 0.23, 0.025, C.white, x, y, z);
  }
  dish(portion) {
    const g = new THREE.Group();
    if (portion.type === "noodles") {
      this.cylinder(
        g,
        0.37,
        0.22,
        0.19,
        portion.takeaway ? 0xb48c54 : C.cream,
        0,
        0.1,
        0,
      );
      this.cylinder(
        g,
        0.33,
        0.33,
        0.025,
        portion.quality === 0 ? 0x554831 : 0x9a713a,
        0,
        0.205,
        0,
      );
      this.noodleNest(g, 0, 0.23, 0, 0.29);
      this.ball(g, 0.075, 0xb77e66, -0.15, 0.27, 0.06);
      this.ball(g, 0.075, 0xb77e66, -0.08, 0.27, -0.12);
      if (portion.chilli) {
        const t = this.group(g, 0.16, 0.27, 0.07);
        this.ball(t, 0.1, 0xc34f30);
        t.userData.interaction = {
          kind: "topping",
          item: "chilli",
          id: portion.id,
          name: `chilli-${portion.id}`,
          label: "Remove chilli · drag back to the chilli jar",
          draggable: true,
        };
      }
      if (portion.garnish)
        for (let i = 0; i < 5; i++)
          this.box(
            g,
            0.035,
            0.045,
            0.08,
            0x669349,
            -0.1 + i * 0.05,
            0.3,
            -0.04,
          );
    } else if (portion.type === "toast") {
      this.cylinder(g, 0.4, 0.4, 0.025, C.cream);
      this.bread(g, 0, 0.08, 0, portion.kaya === true);
      this.bread(g, 0.04, 0.2, 0.03, portion.kaya === true);
    } else {
      this.cup(g, 0, 0, 0, true);
      g.children[1].material = this.material(
        portion.milk ? 0xb88a54 : 0x593b26,
      );
      if (portion.sugar)
        for (let i = 0; i < 3; i++)
          this.box(
            g,
            0.025,
            0.015,
            0.025,
            0xf8e9c1,
            -0.04 + i * 0.035,
            0.3,
            0.015,
          );
    }
    if (portion.takeaway) {
      this.box(g, 0.75, 0.03, 0.65, 0xc49b5f, 0, -0.02, 0);
      this.box(g, 0.05, 0.35, 0.05, 0xb69258, -0.27, 0.14, -0.22);
      this.box(g, 0.05, 0.35, 0.05, 0xb69258, 0.27, 0.14, -0.22);
      this.box(g, 0.55, 0.05, 0.05, 0xb69258, 0, 0.3, -0.22);
    }
    return g;
  }
  person(type) {
    const g = new THREE.Group(),
      chef = type === "chef",
      regular = type === "regular",
      family = type === "family";
    const skin = regular ? 0xc89b74 : family ? 0xc99d75 : 0xdfb389,
      shirt = chef
        ? 0xf4e3bd
        : regular
          ? 0xc47854
          : family
            ? 0xa4ad71
            : 0x7f9e9a;
    const leftLeg = this.group(g, -0.13, 0.48, 0),
      rightLeg = this.group(g, 0.13, 0.48, 0);
    this.box(leftLeg, 0.19, 0.5, 0.23, chef ? C.dark : 0x5e6d60, 0, -0.21, 0);
    this.box(rightLeg, 0.19, 0.5, 0.23, chef ? C.dark : 0x5e6d60, 0, -0.21, 0);
    this.box(leftLeg, 0.22, 0.1, 0.34, C.black, 0, -0.45, 0.055);
    this.box(rightLeg, 0.22, 0.1, 0.34, C.black, 0, -0.45, 0.055);
    this.cylinder(g, 0.3, 0.25, 0.63, shirt, 0, 0.83, 0, 8);
    this.cylinder(g, 0.085, 0.09, 0.13, skin, 0, 1.2, 0, 10);
    const head = this.group(g, 0, 1.48, 0);
    this.ball(head, 0.285, skin, 0, 0, 0);
    const hair = this.ball(
      head,
      0.288,
      chef ? 0x64543b : regular ? 0x777f6b : 0x4d493b,
      0,
      0.075,
      -0.045,
    );
    hair.scale.set(1, 0.67, 0.88);
    for (const x of [-0.096, 0.096]) {
      this.ball(head, 0.022, C.black, x, 0.015, 0.262);
      if (regular) {
        const glasses = new THREE.Mesh(
          new THREE.TorusGeometry(0.072, 0.012, 5, 16),
          this.material(C.black),
        );
        glasses.position.set(x, 0.018, 0.26);
        head.add(glasses);
      }
    }
    this.box(head, 0.074, 0.012, 0.013, 0x995c41, 0, -0.1, 0.266);
    const leftArm = this.group(g, -0.31, 1.05, 0),
      rightArm = this.group(g, 0.31, 1.05, 0);
    for (const [arm, sign] of [
      [leftArm, -1],
      [rightArm, 1],
    ]) {
      this.cylinder(arm, 0.095, 0.085, 0.42, shirt, 0, -0.15, 0, 8);
      this.ball(arm, 0.09, skin, 0, -0.4, 0.01);
      arm.rotation.z = sign * 0.12;
    }
    if (chef) {
      this.box(g, 0.49, 0.55, 0.06, 0xd49c54, 0, 0.76, 0.255);
      this.box(g, 0.035, 0.65, 0.03, 0xb78247, -0.2, 0.95, 0.23);
      this.box(g, 0.035, 0.65, 0.03, 0xb78247, 0.2, 0.95, 0.23);
      this.box(g, 0.35, 0.23, 0.03, 0xc18d49, 0, 0.67, 0.3);
      this.cylinder(head, 0.29, 0.29, 0.13, C.white, 0, 0.27, 0);
      this.ball(head, 0.25, C.white, 0, 0.39, 0);
    }
    if (family) {
      const child = this.person("child");
      child.scale.setScalar(0.62);
      child.position.set(0.57, 0, 0.05);
      g.add(child);
    }
    g.userData.body = { leftLeg, rightLeg, leftArm, rightArm, head };
    return g;
  }
  setView(value) {
    this.view = Math.round(THREE.MathUtils.clamp(value, -1, 1));
    this.renderer.domElement.dataset.view = ["left", "centre", "right"][
      this.view + 1
    ];
    this.callbacks.onCamera?.(this.view);
  }
  customerAnchor(id) {
    const customer = this.customers.get(id);
    if (!customer) return null;
    const p = customer.group.localToWorld(V(0, 2.05, 0)).project(this.camera);
    return this.screenPoint(p);
  }
  react(id, type) {
    const customer = this.customers.get(id);
    if (customer) customer.reaction = { type, start: this.clock };
  }
  beginObjectDrag(name, event) {
    const object = this.objects.get(name),
      info = object?.userData.interaction;
    if (!info?.draggable || event.button !== 0) return;
    const hit = { object, info };
    this.drag = {
      startX: event.clientX,
      startY: event.clientY,
      hit,
      moved: false,
    };
    this.pick(hit);
    this.renderer.domElement.setPointerCapture(event.pointerId);
  }
  resize() {
    const { width, height, left, top } =
      this.container.parentElement.getBoundingClientRect();
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.viewportLeft = left;
    this.viewportTop = top;
    // Station changes never resize (and clear) the WebGL drawing buffer.
    if (this.canvasWidth !== width || this.canvasHeight !== height) {
      this.renderer.setSize(width, height);
      this.canvasWidth = width;
      this.canvasHeight = height;
      this.backdrop.width = Math.ceil(width / 4);
      this.backdrop.height = Math.ceil(height / 4);
    }
    this.updateViewport();
    if (this.hasRendered) this.renderFrame();
  }
  updateViewport() {
    const area = kitchenViewport(
      this.viewportWidth,
      this.viewportHeight,
      this.viewCurrent,
      !this.game || this.game.status === "ready",
    );
    this.workViewport = area;
    this.width = area.width;
    this.height = area.height;
    this.offsetX = this.viewportLeft + area.left;
    this.offsetY = this.viewportTop + area.top;
    Object.assign(this.container.style, {
      inset: `${area.top}px auto auto ${area.left}px`,
      width: `${area.width}px`,
      height: `${area.height}px`,
    });
    const app = this.container.parentElement;
    app.style.setProperty("--scene-left", `${area.left}px`);
    app.style.setProperty("--scene-top", `${area.top}px`);
    app.style.setProperty(
      "--scene-bottom",
      `${this.viewportHeight - area.bottom}px`,
    );
    this.camera.aspect = area.width / area.height;
    this.camera.fov = Math.min(
      130,
      THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(area.height < 500 ? 47 : 42)) /
              this.camera.aspect,
          ),
      ),
    );
    // Extend the same perspective behind the HUD. The visible work region
    // retains its framing while the surround reveals real roof/floor scenery.
    this.camera.setViewOffset(
      area.width,
      area.height,
      -area.left,
      -area.top,
      this.viewportWidth,
      this.viewportHeight,
    );
  }
  screenPoint(point) {
    return {
      x: this.viewportLeft + (point.x * 0.5 + 0.5) * this.viewportWidth,
      y: this.viewportTop + (-point.y * 0.5 + 0.5) * this.viewportHeight,
    };
  }
  getWorkRect() {
    return {
      left: this.offsetX,
      top: this.offsetY,
      width: this.width,
      height: this.height,
      right: this.offsetX + this.width,
      bottom: this.offsetY + this.height,
    };
  }
  renderFrame() {
    const renderer = this.renderer;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, this.viewportWidth, this.viewportHeight);
    renderer.render(this.scene, this.camera);
    // Copy the current rendered frame directly, at low resolution. The browser
    // blurs it behind the HUD; a second 3D scene render is unnecessary.
    if (this.backdropContext) {
      const canvas = renderer.domElement;
      this.backdropContext.drawImage(
        canvas,
        0,
        0,
        this.backdrop.width,
        this.backdrop.height,
      );
      this.backdrop.dataset.ready = "true";
    }
    this.hasRendered = true;
  }
  info(object) {
    let node = object;
    while (node && node !== this.scene) {
      if (node.userData.interaction)
        return { object: node, info: node.userData.interaction };
      node = node.parent;
    }
    return null;
  }
  hit(x, y, { drop = false } = {}) {
    const rect = this.getWorkRect();
    this.pointer.set(
      ((x - this.viewportLeft) / this.viewportWidth) * 2 - 1,
      (-(y - this.viewportTop) / this.viewportHeight) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom)
      return null;
    const hits = this.ray.intersectObjects([...this.objects.values()], true);
    for (const hit of hits) {
      const result = this.info(hit.object);
      if (!result || !result.object.visible) continue;
      if (
        drop &&
        this.held &&
        !this.callbacks.accepts(this.held.info, result.info)
      )
        continue;
      return result;
    }
    return null;
  }
  bindPointer() {
    const canvas = this.renderer.domElement;
    this.pointerDown = (e) => {
      if (e.button === 2) {
        this.panDrag = { x: e.clientX, view: this.view };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (e.button !== 0) return;
      const hit = this.hit(e.clientX, e.clientY);
      this.drag = { startX: e.clientX, startY: e.clientY, hit, moved: false };
      if (hit?.info.draggable && !this.held) {
        this.pick(hit);
        canvas.setPointerCapture(e.pointerId);
      }
    };
    this.pointerMove = (e) => {
      if (this.panDrag) {
        this.setView(this.panDrag.view - (e.clientX - this.panDrag.x) / 150);
        return;
      }
      if (
        this.drag &&
        Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) >
          7
      )
        this.drag.moved = true;
      const hit = this.hit(e.clientX, e.clientY, { drop: !!this.held });
      this.callbacks.onHover?.(hit?.info ?? null, {
        x: e.clientX,
        y: e.clientY,
        holding: this.held?.info,
      });
      canvas.style.cursor = this.held
        ? "grabbing"
        : hit?.info.draggable
          ? "grab"
          : hit
            ? "pointer"
            : "default";
      this.halo.visible = !!hit;
      if (hit) {
        hit.object.getWorldPosition(this.halo.position);
        this.halo.position.y += 0.035;
        this.halo.scale.setScalar(hit.info.kind === "customer" ? 1.1 : 0.9);
      }
      if (this.ghost) {
        const plane = new THREE.Plane(V(0, 1, 0), -1.8);
        const p = V(0, 0, 0);
        if (this.ray.ray.intersectPlane(plane, p)) this.ghost.position.copy(p);
      }
      this.lastPointer = { x: e.clientX, y: e.clientY };
      if (this.held && this.clock - (this.lastEdgeTurn ?? -10) > 0.7) {
        if (e.clientX < this.offsetX + 36) {
          this.setView(this.view - 1);
          this.lastEdgeTurn = this.clock;
        } else if (e.clientX > this.offsetX + this.width - 36) {
          this.setView(this.view + 1);
          this.lastEdgeTurn = this.clock;
        }
      }
    };
    this.pointerUp = (e) => {
      if (this.panDrag) {
        this.panDrag = null;
        return;
      }
      if (this.held) {
        let target = this.hit(e.clientX, e.clientY, { drop: true });
        if (!target) {
          const attempted = this.hit(e.clientX, e.clientY);
          if (attempted?.info.kind === "customer") target = attempted;
        }
        if (this.drag?.moved) {
          if (target)
            this.callbacks.onDrop(this.held.info, target.info, {
              imperfect: e.shiftKey,
            });
          if (!this.keepTool(this.held.info, target?.info)) this.cancelPick();
        } else if (
          this.drag?.hit?.info.name !== this.held.info.name &&
          target
        ) {
          this.callbacks.onDrop(this.held.info, target.info, {
            imperfect: e.shiftKey,
          });
          if (!this.keepTool(this.held.info, target.info)) this.cancelPick();
        }
      }
      this.drag = null;
    };
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerup", this.pointerUp);
    canvas.addEventListener("pointercancel", () => {
      this.drag = null;
      this.cancelPick();
      this.panDrag = null;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  pick(hit) {
    this.cancelPick();
    this.held = { ...hit, info: this.callbacks.onLift?.(hit.info) || hit.info };
    this.ghostGenerated = false;
    const item = hit.info.kind === "ingredient" ? hit.info.item : null;
    if (
      ["noodles", "bread", "cup", "chilli", "garnish", "takeaway"].includes(
        item,
      )
    ) {
      this.ghost = new THREE.Group();
      this.ghostGenerated = true;
      if (item === "noodles") this.noodleNest(this.ghost, 0, 0, 0, 0.25);
      if (item === "bread") this.bread(this.ghost);
      if (item === "cup") this.cup(this.ghost);
      if (item === "chilli") this.ball(this.ghost, 0.13, C.red);
      if (item === "garnish")
        for (let i = 0; i < 5; i++)
          this.box(
            this.ghost,
            0.04,
            0.04,
            0.12,
            0x6d9349,
            (i - 2) * 0.07,
            0,
            0,
          );
      if (item === "takeaway") this.box(this.ghost, 0.7, 0.035, 0.6, 0xbe995e);
    } else this.ghost = hit.object.clone(true);
    this.ghost.traverse((n) => {
      if (n.isMesh) {
        n.material = n.material.clone();
        n.material.transparent = true;
        n.material.opacity = 0.72;
        n.material.depthTest = false;
        n.renderOrder = 7;
      }
    });
    hit.object.getWorldPosition(this.ghost.position);
    this.ghost.position.y += 0.2;
    this.scene.add(this.ghost);
    for (const target of this.objects.values())
      if (
        target.visible &&
        this.callbacks.accepts(hit.info, target.userData.interaction)
      ) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.44, 0.49, 32),
          new THREE.MeshBasicMaterial({
            color: 0xffdc86,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthTest: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.renderOrder = 6;
        this.scene.add(ring);
        this.dropRings.push({ ring, target });
      }
    this.callbacks.onPick?.(this.held.info);
  }
  keepTool(source, target) {
    return (
      source?.kind === "ingredient" &&
      ((source.item === "cleaver" &&
        target?.kind === "board" &&
        this.game.chop.loaded) ||
        (source.item === "knife" &&
          target?.item === "kaya" &&
          this.game.knifeLoaded))
    );
  }
  cancelPick() {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      this.ghost.traverse((n) => {
        if (n.isMesh) {
          n.material.dispose();
          if (this.ghostGenerated) n.geometry.dispose();
        }
      });
      this.ghost = null;
    }
    for (const { ring } of this.dropRings) {
      ring.removeFromParent();
      ring.geometry.dispose();
      ring.material.dispose();
    }
    this.dropRings = [];
    this.held = null;
    if (this.halo) this.halo.visible = false;
    this.callbacks.onPick?.(null);
  }
  remove(group) {
    group.removeFromParent();
    group.traverse((n) => {
      if (n.isMesh) {
        n.geometry.dispose();
        if (n.material.userData.local) {
          n.material.map?.dispose();
          n.material.dispose();
        }
      }
    });
  }
  sync(game) {
    this.game = game;
    this.kayaOnKnife.visible = game.knifeLoaded;
    this.objects.get("knife").userData.interaction.label = game.knifeLoaded
      ? "Loaded kaya spreader · spread onto cooked toast"
      : "Kaya spreader · dip into the kaya jar first";
    this.ghost?.getObjectByName("kaya-on-knife")?.traverse((mesh) => {
      mesh.visible = game.knifeLoaded;
    });
    const chopped = this.choppedGreens.userData.interaction;
    chopped.draggable = game.choppedVegetables > 0;
    chopped.label = `Chopped greens · ${game.choppedVegetables} portions ready`;
    this.choppedGreens.children.slice(2).forEach((mesh, i) => {
      mesh.visible = i < game.choppedVegetables * 3;
    });
    const boardKey = `${game.chop.loaded}:${game.chop.cuts}`;
    if (this.boardKey !== boardKey) {
      this.boardKey = boardKey;
      for (const child of [...this.boardFood.children]) this.remove(child);
      if (game.chop.loaded)
        this.greens(this.boardFood, game.chop.cuts > 0, 5 + game.chop.cuts * 2);
    }
    for (let i = 0; i < 3; i++)
      this.objects.get(`spot-${i}`).visible =
        i < game.maxPlates && !game.plates.some((p) => p.slot === i);
    if (game.upgrades.includes("basket") && !this.objects.has("pot-1")) {
      const g = this.group(this.scene, -3.1, 1.4, -1.15);
      g.scale.setScalar(0.68);
      this.pot(g);
      this.register(
        "pot-1",
        g,
        { kind: "pot", slot: 1, label: "Second noodle basket" },
        [0, 0.4, 0],
      );
    }
    const active = new Set(game.orders.map((o) => o.id));
    for (const [id, c] of this.customers) if (!active.has(id)) c.leaving = true;
    game.orders.forEach((order) => {
      if (!this.customers.has(order.id)) {
        const occupied = new Set(
          [...this.customers.values()]
            .filter((c) => !c.leaving)
            .map((c) => c.slot),
        );
        const slot = [0, 1, 2].find((s) => !occupied.has(s)) ?? 0;
        const g = this.person(order.type);
        g.position.set((slot % 2 ? -1 : 1) * 7, 0, -10 - slot * 2);
        this.scene.add(g);
        this.register(
          `customer-${order.id}`,
          g,
          {
            kind: "customer",
            id: order.id,
            label: `${order.name} · hand over a matching dish`,
          },
          [0, 2.15, 0],
        );
        this.customers.set(order.id, {
          group: g,
          slot,
          leaving: false,
          arrived: false,
        });
      }
      this.customers.get(order.id).order = order;
    });
    const key = JSON.stringify({
      p: game.plates.map((p) => [
        p.id,
        p.type,
        p.chilli,
        p.garnish,
        p.takeaway,
      ]),
      h: game.holding.map((p) => [
        p.id,
        p.type,
        p.quality,
        p.kaya,
        p.milk,
        p.sugar,
        p.garnish,
        p.station,
      ]),
      j: game.jobs.map((j) => [j.id, j.type, j.quantity]),
      n: game.maxPlates,
      finishes: game.plates.map((p) => [p.kaya, p.milk, p.sugar]),
      chop: [game.chop.loaded, game.chop.cuts, game.choppedVegetables],
    });
    if (key !== this.stateKey) {
      this.stateKey = key;
      for (const [name, g] of this.dishes) {
        this.objects.delete(name);
        this.remove(g);
      }
      this.dishes.clear();
      for (const [id, g] of this.baskets) {
        this.objects.delete(`basket-${id}`);
        this.remove(g);
      }
      this.baskets.clear();
      game.plates.forEach((p, i) => {
        const g = this.dish(p);
        g.position.set(-1.1 + (p.slot ?? i) * 1.1, 1.36, -0.75);
        this.scene.add(g);
        const name = `plate-${p.id}`;
        this.register(
          name,
          g,
          {
            kind: "plate",
            id: p.id,
            label: this.dishLabel(p),
            draggable: true,
          },
          [0, 0.3, 0],
        );
        this.dishes.set(name, g);
      });
      game.holding.forEach((p, i) => {
        const g = this.dish(p);
        g.scale.setScalar(0.72);
        const kindIndex = game.holding
          .slice(0, i)
          .filter(
            (v) => (v.station === "coffee") === (p.station === "coffee"),
          ).length;
        if (p.station === "coffee")
          g.position.set(3.23, 1.38, 2.0 + kindIndex * 0.55);
        else
          g.position.set(
            -1.65 + (kindIndex % 3) * 0.42,
            1.4 + Math.floor(kindIndex / 3) * 0.14,
            -1.5,
          );
        this.scene.add(g);
        const name = `prepared-${p.id}`;
        this.register(
          name,
          g,
          {
            kind: "prepared",
            id: p.id,
            label:
              p.quality === 0
                ? "Burnt portion · drag to the bin"
                : this.dishLabel(p) + " · move to a plating spot",
            draggable: true,
          },
          [0, 0.25, 0],
        );
        this.dishes.set(name, g);
      });
      game.jobs.forEach((job) => {
        if (job.type === "toast") {
          const g = new THREE.Group();
          this.bread(g, 0, 0, 0, false);
          g.position.set(-3.7, 1.5, 0.25);
          this.scene.add(g);
          this.register(
            `toast-job-${job.id}`,
            g,
            {
              kind: "grill-toast",
              id: job.id,
              label:
                "Toast · drag off the grill to a plating spot after 2 seconds",
              draggable: true,
            },
            [0, 0.12, 0],
          );
          this.dishes.set(`toast-job-${job.id}`, g);
          return;
        }
        const g = new THREE.Group();
        this.cylinder(g, 0.3, 0.25, 0.1, 0xac9566);
        this.noodleNest(g, 0, 0.08, 0, 0.25);
        this.box(g, 0.08, 0.06, 0.65, C.wood, 0, 0.06, 0.42);
        g.position.set(
          job.slot ? -3.1 : -3.69,
          job.slot ? 1.75 : 1.96,
          job.slot ? -1.15 : -0.9,
        );
        this.scene.add(g);
        this.register(
          `basket-${job.id}`,
          g,
          {
            kind: "basket",
            id: job.id,
            label: `${job.quantity} portion${job.quantity > 1 ? "s" : ""} · lift into a bowl at 2–4 seconds`,
            draggable: true,
          },
          [0, 0.14, 0],
        );
        this.baskets.set(job.id, g);
      });
    }
    for (const job of game.jobs) {
      if (job.type !== "toast") continue;
      const bread = this.dishes.get(`toast-job-${job.id}`);
      if (bread)
        bread.children[1].material = this.material(
          job.time < 2 ? 0xf1d899 : job.time < 6 ? 0xd69b56 : 0x594331,
        );
    }
    const activeJobs = new Set(game.jobs.map((j) => j.id));
    for (const [id, cue] of this.cookRings)
      if (!activeJobs.has(id)) {
        cue.ring.removeFromParent();
        cue.ring.geometry.dispose();
        cue.ring.material.dispose();
        this.cookRings.delete(id);
      }
    for (const job of game.jobs) {
      let cue = this.cookRings.get(job.id);
      if (!cue) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.38, 0.44, 36),
          new THREE.MeshBasicMaterial({
            color: 0xc5e68d,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthTest: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.renderOrder = 5;
        this.scene.add(ring);
        cue = { ring };
        this.cookRings.set(job.id, cue);
      }
      cue.source = this.objects.get(
        job.type === "toast" ? `toast-job-${job.id}` : `basket-${job.id}`,
      );
      cue.ring.visible = job.time >= 2;
      cue.ring.material.color.setHex(
        job.time > 4
          ? 0xf28c65
          : cookPhase(job.time) === "hurry"
            ? 0xffd477
            : 0xc5e68d,
      );
    }
  }
  project() {
    const entries = [];
    this.ticketCamera.copy(this.camera);
    this.ticketCamera.lookAt(0, 1.25, -3.35);
    this.ticketCamera.updateMatrixWorld();
    for (const [name, g] of this.objects) {
      if (!g.visible) continue;
      const p = g.localToWorld((g.userData.pickup || V(0, 0.2, 0)).clone());
      p.project(this.camera);
      const label = g
        .localToWorld((g.userData.anchor || V(0, 0.2, 0)).clone())
        .project(this.camera);
      const customer = name.startsWith("customer-")
        ? this.customers.get(g.userData.interaction.id)
        : null;
      const counterLabel = customer
        ? g
            .localToWorld((g.userData.anchor || V(0, 0.2, 0)).clone())
            .project(this.ticketCamera)
        : null;
      const point = this.screenPoint(p);
      const labelPoint = this.screenPoint(label);
      const counterPoint = counterLabel ? this.screenPoint(counterLabel) : null;
      entries.push({
        ...g.userData.interaction,
        name,
        x: point.x,
        y: point.y,
        labelX: labelPoint.x,
        labelY: labelPoint.y,
        counterLabelX: counterPoint?.x ?? null,
        counterLabelY: counterPoint?.y ?? null,
        visible:
          p.z < 1 &&
          p.z > -1 &&
          point.x >= this.offsetX &&
          point.x <= this.offsetX + this.width &&
          point.y >= this.offsetY &&
          point.y <= this.offsetY + this.height &&
          (!customer || (customer.arrived && !customer.leaving)),
        arrived: customer?.arrived,
      });
    }
    this.callbacks.onProject?.(entries);
  }
  dishLabel(p) {
    if (p.type === "toast")
      return p.kaya
        ? "Kaya toast · ready to serve"
        : "Plain toast · dip spreader in kaya, then spread";
    if (p.type === "kopi")
      return `Coffee · ${p.milk ? "milk added" : "black"} · ${p.sugar ? "sugar added" : "no sugar"}`;
    return `Bak chor mee · ${p.garnish ? "greens added" : "needs chopped greens"} · ${p.chilli ? "chilli" : "no chilli"}`;
  }
  update(dt) {
    this.clock += dt;
    const t = this.clock;
    this.viewCurrent = ease(this.viewCurrent, this.view, dt, 5);
    this.updateViewport();
    const v = this.viewCurrent;
    const angle = v * 1.4;
    this.camera.position.set(0, 2.45, 1.65);
    this.camera.lookAt(Math.sin(angle) * 5, 1.25, 1.65 - Math.cos(angle) * 5);
    this.camera.updateMatrixWorld();
    for (const fan of this.fans) fan.rotation.y += dt * 3;
    for (const p of this.pedestrians) {
      const walking = this.game?.status !== "paused";
      if (walking) {
        p.group.position.x = p.origin.x + Math.sin(t * p.speed + p.phase) * 2;
        p.group.rotation.y =
          Math.cos(t * p.speed + p.phase) > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.walk(p.group, t * 4 + p.phase, 0.14);
      }
    }
    if (this.game) {
      this.cleaverGlow.visible = this.game.chop.loaded;
      this.cleaverGlow.material.opacity = 0.16 + Math.sin(t * 4) * 0.06;
      this.pourDisplay.visible = this.game.pouring > 0;
      const running = this.game.status === "running";
      for (const [id, c] of this.customers) {
        const target = c.leaving
          ? V(9, 0, -12)
          : V((c.slot - 1) * 2.35, 0, -2.9);
        const delta = target.clone().sub(c.group.position);
        delta.y = 0; // A celebration hop must not make an arrived customer "walk" again.
        const dist = delta.length();
        if ((running || c.leaving) && dist > 0.05) {
          const step = Math.min(dist, dt * 2.7);
          c.group.position.addScaledVector(delta.normalize(), step);
          c.group.rotation.y = ease(
            c.group.rotation.y,
            Math.atan2(delta.x, delta.z),
            dt,
            8,
          );
          this.walk(c.group, t * 8 + id, 0.27);
          c.arrived = false;
        } else if (!c.leaving && dist <= 0.08) {
          c.arrived = true;
          c.group.rotation.y = ease(c.group.rotation.y, 0, dt);
          this.walk(c.group, 0, 0);
          c.group.userData.body.head.rotation.z = Math.sin(t + id) * 0.035;
        }
        const body = c.group.userData.body;
        const reaction =
          c.reaction && t - c.reaction.start < 1.4 ? c.reaction : null;
        const impatient =
          c.arrived && !c.leaving && customerPhase(c.order) !== "patient";
        c.group.position.y =
          reaction?.type === "happy"
            ? Math.sin(Math.min(1, (t - reaction.start) / 1.2) * Math.PI) * 0.26
            : 0;
        body.head.rotation.y =
          reaction?.type === "wrong" ? Math.sin(t * 17) * 0.22 : 0;
        body.head.rotation.x = reaction?.type === "sad" ? 0.25 : 0;
        body.rightArm.rotation.z =
          reaction?.type === "happy"
            ? -0.9 + Math.sin(t * 15) * 0.2
            : impatient
              ? -0.65 + Math.sin(t * 6) * 0.15
              : 0.12;
        if (impatient) body.leftLeg.rotation.x = Math.sin(t * 9) * 0.09;
        if (c.leaving && dist < 0.08) {
          this.objects.delete(`customer-${id}`);
          this.remove(c.group);
          this.customers.delete(id);
        }
      }
      this.steam.forEach((m, i) => {
        const job = this.game.jobs.find((j) => j.type === "noodles");
        m.visible = !!job;
        if (job) {
          const s = (t * 0.55 + i * 0.073) % 1;
          m.position.set(
            (job.slot ? -3.1 : -3.69) + Math.sin(i * 2.2 + s * 3) * 0.2,
            2 + s * 0.9,
            -0.9 + Math.cos(i * 1.8) * 0.16,
          );
          m.scale.setScalar(0.5 + s * 1.6);
          m.material.opacity = (1 - s) * 0.35;
        }
      });
    }
    if (this.ghost) this.ghost.rotation.y += dt * 0.3;
    if (this.ghost && this.held?.info.item === "cleaver")
      this.ghost.rotation.z =
        this.game?.chop.cooldown > 0
          ? Math.sin((this.game.chop.cooldown / 0.3) * Math.PI) * 0.7
          : 0;
    for (const { ring, target } of this.dropRings) {
      target.getWorldPosition(ring.position);
      ring.position.y += 0.04;
      ring.material.opacity = 0.6 + Math.sin(t * 5) * 0.2;
      ring.visible = target.visible;
    }
    for (const { ring, source } of this.cookRings.values())
      if (source) {
        source.getWorldPosition(ring.position);
        ring.position.y += 0.02;
        ring.scale.setScalar(1 + Math.sin(t * 9) * 0.07);
        ring.material.opacity = 0.65 + Math.sin(t * 9) * 0.2;
      }
    this.renderFrame();
    this.project();
  }
  walk(group, t, amplitude) {
    const b = group.userData.body;
    b.leftLeg.rotation.x = Math.sin(t) * amplitude;
    b.rightLeg.rotation.x = -Math.sin(t) * amplitude;
    b.leftArm.rotation.x = -Math.sin(t) * amplitude;
    b.rightArm.rotation.x = Math.sin(t) * amplitude;
  }
  reset() {
    this.cancelPick();
    for (const [id, c] of this.customers) {
      this.objects.delete(`customer-${id}`);
      this.remove(c.group);
    }
    this.customers.clear();
    for (const [name, g] of this.dishes) {
      this.objects.delete(name);
      this.remove(g);
    }
    this.dishes.clear();
    for (const [id, g] of this.baskets) {
      this.objects.delete(`basket-${id}`);
      this.remove(g);
    }
    this.baskets.clear();
    for (const { ring } of this.cookRings.values()) {
      ring.removeFromParent();
      ring.geometry.dispose();
      ring.material.dispose();
    }
    this.cookRings.clear();
    this.stateKey = "";
  }
  dispose() {
    window.removeEventListener("resize", this.boundResize);
    this.cancelPick();
    for (const { ring } of this.cookRings.values()) ring.material.dispose();
    this.scene.traverse((n) => {
      if (n.isMesh) n.geometry.dispose();
    });
    for (const mat of this.materials.values()) mat.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.backdrop.remove();
    this.backdrop.width = this.backdrop.height = 1;
  }
}
