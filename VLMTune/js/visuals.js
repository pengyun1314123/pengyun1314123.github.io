/* Three.js 3D 可视化：Transformer 信息流 / 架构堆栈 / 多模态架构 */
const VLMVisuals = (function () {

  function setup(canvas) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const l1 = new THREE.PointLight(0x22d3ee, 1.1); l1.position.set(6, 6, 8); scene.add(l1);
    const l2 = new THREE.PointLight(0xa78bfa, 0.9); l2.position.set(-6, -4, 5); scene.add(l2);
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    return { scene, camera, renderer };
  }

  function animate(fn) { requestAnimationFrame(function loop(t) { fn(t * 0.001); requestAnimationFrame(loop); }); }

  // ---------- HERO: 分层网络 + 流动粒子 ----------
  function initHero(canvas) {
    const { scene, camera, renderer } = setup(canvas);
    camera.position.set(0, 0, 15);
    const group = new THREE.Group(); scene.add(group);

    const layers = [4, 5, 5, 3];
    const positions = [];
    const Z = [-3.5, -1.2, 1.2, 3.5];
    layers.forEach((cnt, li) => {
      for (let i = 0; i < cnt; i++) {
        const y = (i - (cnt - 1) / 2) * 1.5;
        positions.push({ x: 0, y, z: Z[li], li });
        const color = [0x22d3ee, 0x4f9dff, 0xa78bfa, 0x34d399][li];
        const sphere = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.34, 1),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 })
        );
        sphere.position.set(0, y, Z[li]);
        sphere.userData.phase = Math.random() * Math.PI * 2;
        group.add(sphere);
      }
    });

    // 连线
    const lineMat = new THREE.LineBasicMaterial({ color: 0x3b6fa8, transparent: true, opacity: 0.28 });
    for (let li = 0; li < layers.length - 1; li++) {
      const cur = positions.filter(p => p.li === li), nxt = positions.filter(p => p.li === li + 1);
      cur.forEach(a => nxt.forEach(b => {
        const g = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, a.y, a.z), new THREE.Vector3(0, b.y, b.z)
        ]);
        group.add(new THREE.Line(g, lineMat));
      }));
    }

    // 流动粒子
    const particles = [];
    for (let k = 0; k < 22; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshBasicMaterial({ color: k % 2 ? 0x22d3ee : 0xa78bfa }));
      const li = Math.floor(Math.random() * (layers.length - 1));
      const from = positions.filter(p => p.li === li), to = positions.filter(p => p.li === li + 1);
      m.userData = { a: from[Math.floor(Math.random() * from.length)], b: to[Math.floor(Math.random() * to.length)], t: Math.random() };
      group.add(m); particles.push(m);
    }

    animate(t => {
      group.rotation.y = Math.sin(t * 0.25) * 0.5;
      group.rotation.x = Math.sin(t * 0.18) * 0.12;
      group.children.forEach(c => {
        if (c.userData.phase !== undefined) {
          const s = 1 + Math.sin(t * 2 + c.userData.phase) * 0.12;
          c.scale.setScalar(s);
        }
      });
      particles.forEach(p => {
        p.userData.t += 0.006; if (p.userData.t > 1) p.userData.t = 0;
        const { a, b, t: f } = p.userData;
        p.position.set(0, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f);
      });
      renderer.render(scene, camera);
    });
  }

  // ---------- ARCH: Transformer Block 堆栈 ----------
  function initArch(canvas) {
    const { scene, camera, renderer } = setup(canvas);
    camera.position.set(8, 6, 12); camera.lookAt(0, 0, 0);
    const group = new THREE.Group(); scene.add(group);

    const colors = [0x22d3ee, 0x4f9dff, 0xa78bfa, 0x22d3ee];
    for (let i = 0; i < 4; i++) {
      const y = (i - 1.5) * 2.5;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 1.8, 3.2),
        new THREE.MeshStandardMaterial({ color: colors[i], transparent: true, opacity: 0.14, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide })
      );
      box.position.y = y; group.add(box);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry),
        new THREE.LineBasicMaterial({ color: colors[i], transparent: true, opacity: 0.8 }));
      edges.position.y = y; group.add(edges);

      // attention heads（小球）
      for (let h = 0; h < 4; h++) {
        const hb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
        hb.position.set(-1.8 + h * 1.2, y, 1.7); group.add(hb);
      }
      // 文字标签：用简单 sprite
      const label = makeLabel(i === 0 ? 'Embedding + RoPE' : i === 3 ? 'LM Head' : 'Transformer Block');
      label.position.set(0, y, -1.9); label.scale.set(3.2, 0.64, 1); group.add(label);
    }
    // 数据流箭头柱
    const flow = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.5 }));
    flow.position.set(3.4, 0, 0); group.add(flow);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 8),
      new THREE.MeshBasicMaterial({ color: 0x34d399 }));
    cone.position.set(3.4, -5.3, 0); cone.rotation.x = Math.PI; group.add(cone);

    let drag = false, px = 0, py = 0;
    canvas.addEventListener('mousedown', e => { drag = true; px = e.clientX; py = e.clientY; });
    window.addEventListener('mouseup', () => drag = false);
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      group.rotation.y += (e.clientX - px) * 0.008;
      group.rotation.x += (e.clientY - py) * 0.005;
      px = e.clientX; py = e.clientY;
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      camera.position.multiplyScalar(e.deltaY > 0 ? 1.06 : 0.94);
      camera.position.clampLength(6, 30);
    }, { passive: false });

    animate(t => { if (!drag) group.rotation.y += 0.0015; renderer.render(scene, camera); });
  }

  // ---------- MM: 图像 → 投影 → LLM ----------
  function initMM(canvas) {
    const { scene, camera, renderer } = setup(canvas);
    camera.position.set(0, 2, 15); camera.lookAt(0, 0, 0);
    const group = new THREE.Group(); scene.add(group);

    // 左侧：图像 patch 网格 (6x6)
    const patchGroup = new THREE.Group();
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38),
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
      m.position.set(-5.5 + i * 0.44, 2.2 - j * 0.44, 0);
      m.rotation.y = 0.3; patchGroup.add(m);
    }
    group.add(patchGroup);
    const imgLabel = makeLabel('ViT Patches'); imgLabel.position.set(-4.1, -1.1, 0); imgLabel.scale.set(2.6, 0.52, 1); group.add(imgLabel);

    // 中间：投影层（发光环）
    const proj = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.16, 12, 40),
      new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0x6d28d9, emissiveIntensity: 0.7 }));
    proj.position.set(-0.3, 0.5, 0); proj.rotation.y = 0.5; group.add(proj);
    const projLabel = makeLabel('MLP Projector'); projLabel.position.set(-0.3, -1.5, 0); projLabel.scale.set(2.8, 0.52, 1); group.add(projLabel);

    // 右侧：LLM Block 堆栈
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.85, 2),
        new THREE.MeshStandardMaterial({ color: 0x34d399, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
      b.position.set(3.8, 2.2 - i * 1.15, 0); group.add(b);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry),
        new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.7 }));
      e.position.copy(b.position); group.add(e);
    }
    const llmLabel = makeLabel('LLM'); llmLabel.position.set(3.8, -2.9, 0); llmLabel.scale.set(2, 0.5, 1); group.add(llmLabel);

    // 连接线 + 流动粒子
    const lineMat = new THREE.LineBasicMaterial({ color: 0x4b6a9c, transparent: true, opacity: 0.5 });
    [[-3.1, 0.8, -1.4, 0.5], [0.8, 0.5, 2.5, 0.8]].forEach(([x1, y1, x2, y2]) => {
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0)]), lineMat));
    });
    const particles = [];
    for (let k = 0; k < 12; k++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshBasicMaterial({ color: k % 2 ? 0x22d3ee : 0xa78bfa }));
      p.userData = { t: Math.random(), speed: 0.004 + Math.random() * 0.004 };
      group.add(p); particles.push(p);
    }
    let drag = false, px = 0;
    canvas.addEventListener('mousedown', e => { drag = true; px = e.clientX; });
    window.addEventListener('mouseup', () => drag = false);
    window.addEventListener('mousemove', e => { if (drag) { group.rotation.y += (e.clientX - px) * 0.006; px = e.clientX; } });

    animate(t => {
      proj.rotation.z += 0.01;
      if (!drag) group.rotation.y = Math.sin(t * 0.2) * 0.18;
      particles.forEach(p => {
        p.userData.t += p.userData.speed; if (p.userData.t > 1) p.userData.t = 0;
        const f = p.userData.t;
        const x = f < 0.5 ? -3.1 + f * 2 * 2.4 : 0.8 + (f - 0.5) * 2 * 2.0;
        p.position.set(x, f < 0.5 ? 0.8 - f * 0.6 : 0.5 + (f - 0.5) * 0.6, 0.1);
      });
      renderer.render(scene, camera);
    });
  }

  function makeLabel(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 100;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(10,16,30,0.85)'; ctx.fillRect(0, 0, 512, 100);
    ctx.font = 'bold 36px sans-serif'; ctx.fillStyle = '#8fe9f5';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 52);
    const tex = new THREE.CanvasTexture(c);
    return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  }

  return { initHero, initArch, initMM };
})();
