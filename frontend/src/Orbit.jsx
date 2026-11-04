import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArrowDown, CaretLeft, CaretRight } from '@phosphor-icons/react';
import './orbit.css';

const TAU = Math.PI * 2;
const shortestAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

export function Orbit({ books, selected, onSelect }) {
  const host = useRef(null);
  const engine = useRef(null);
  const latest = useRef({ books, selected, onSelect });
  latest.current = { books, selected, onSelect };
  const [unavailable, setUnavailable] = useState(false);
  const signature = books.map(book => `${book.id}:${book.cover ?? ''}`).join('|');

  useEffect(() => {
    const element = host.current;
    const entries = latest.current.books;
    const count = entries.length === 1 ? 1 : Math.ceil(36 / entries.length) * entries.length;
    const step = TAU / count;
    let disposed = false;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.dataset.ready = 'false';
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 60);
    camera.position.set(0, 3.6, 10.2);
    camera.lookAt(0, 0.28, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbdb7ac, 2.5));
    const key = new THREE.DirectionalLight(0xfffaf1, 3.5);
    key.position.set(-4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.0002;
    key.shadow.radius = 3;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe3ecff, 1.2);
    fill.position.set(4, 3, -5);
    scene.add(fill);

    const geometries = [];
    const materials = [];
    const textures = [];
    const geometry = (...args) => { const result = new THREE.BoxGeometry(...args); geometries.push(result); return result; };
    const material = options => { const result = new THREE.MeshStandardMaterial({ roughness: 0.88, ...options }); materials.push(result); return result; };
    const bookGeometry = geometry(0.69, 1.09, 0.096);
    const paper = material({ color: 0xf2eee2 });
    const manager = new THREE.LoadingManager(() => { if (!disposed) { renderer.domElement.dataset.textures = 'ready'; renderSoon(); } });
    const textureLoader = new THREE.TextureLoader(manager);
    if (!entries.some(book => book.cover)) renderer.domElement.dataset.textures = 'ready';
    const atlas = entries.map(book => {
      const face = material({ color: book.cover ? 0xffffff : 0xe9e5dc });
      const spine = material({ color: 0x645f54 });
      if (book.cover) {
        const texture = textureLoader.load(book.cover, () => {
          if (disposed) { texture.dispose(); return; }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          face.map = texture;
          face.needsUpdate = true;
          // Reuse actual cover pixels for the narrow binding, rather than drawing cover art.
          const binding = texture.clone();
          binding.repeat.set(0.035, 1);
          binding.needsUpdate = true;
          textures.push(binding);
          spine.color.set(0xffffff);
          spine.map = binding;
          spine.needsUpdate = true;
          renderSoon();
        }, undefined, () => { if (!disposed) renderSoon(); });
        textures.push(texture);
      }
      return { face, spine };
    });
    const ring = new THREE.Group();
    scene.add(ring);
    const pickable = [];
    for (let i = 0; i < count; i++) {
      const book = entries[i % entries.length];
      const surfaces = atlas[i % entries.length];
      const object = new THREE.Group();
      const angle = i * step;
      const radius = count === 1 ? 0 : 3.5;
      object.position.set(Math.sin(angle) * radius, 0.56, Math.cos(angle) * radius);
      // Radially oriented volumes reveal their covers, bindings and page edges as they rotate.
      object.rotation.y = angle + 1.05;
      const mesh = new THREE.Mesh(bookGeometry, [paper, surfaces.spine, paper, paper, surfaces.face, surfaces.face]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.bookId = book.id;
      object.add(mesh);
      pickable.push(mesh);
      ring.add(object);
    }
    const floorGeometry = new THREE.PlaneGeometry(14, 14);
    const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.065 });
    geometries.push(floorGeometry); materials.push(floorMaterial);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    let angle = 0;
    let target = 0;
    let frame = 0;
    let lastTime = 0;
    let visible = true;
    let lastWheel = -Infinity;
    let lastScroll = window.scrollY;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    function render(time) {
      frame = 0;
      if (disposed || !visible) return;
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
      lastTime = time;
      angle = reducedMotion.matches ? target : angle + (target - angle) * (1 - Math.exp(-9 * dt));
      if (Math.abs(target - angle) < 0.0001) angle = target;
      ring.rotation.y = angle;
      renderer.render(scene, camera);
      renderer.domElement.dataset.angle = angle.toFixed(5);
      renderer.domElement.dataset.ready = 'true';
      if (angle !== target) frame = requestAnimationFrame(render);
    }
    function renderSoon() { if (!disposed && visible && !frame) { lastTime = 0; frame = requestAnimationFrame(render); } }
    function align(id) {
      let nearest = Infinity;
      for (let i = 0; i < count; i++) {
        if (entries[i % entries.length].id !== id) continue;
        const delta = shortestAngle(-i * step - target);
        if (Math.abs(delta) < Math.abs(nearest)) nearest = delta;
      }
      if (Number.isFinite(nearest)) { target += nearest; renderSoon(); }
    }
    engine.current = { align };
    align(latest.current.selected.id);
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      const frameHeight = Math.max(4.4, 8.8 / camera.aspect);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(frameHeight / (2 * camera.position.length())));
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderSoon();
    });
    observer.observe(element);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) renderSoon();
    });
    intersection.observe(element);
    function canRotate(event) {
      return visible && !reducedMotion.matches && count > 1 && !document.querySelector('dialog[open]')
        && !event.target?.closest?.('input, select, textarea, .book-index');
    }
    function wheel(event) {
      if (!canRotate(event)) return;
      lastWheel = performance.now();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      target += Math.max(-240, Math.min(240, (event.deltaY || event.deltaX) * unit)) * 0.0022;
      renderSoon();
    }
    function scroll(event) {
      const delta = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      if (performance.now() - lastWheel < 120 || !canRotate(event)) return;
      target += delta * 0.0022;
      renderSoon();
    }
    // Passive listeners keep ordinary page scrolling, including trackpads and touch, intact.
    window.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true });
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = null;
    function pointerDown(event) { down = { x: event.clientX, y: event.clientY, target }; }
    function pointerMove(event) {
      if (down && event.pointerType !== 'mouse' && Math.abs(event.clientX - down.x) > Math.abs(event.clientY - down.y)) {
        target = down.target + (event.clientX - down.x) * 0.008;
        renderSoon();
      }
    }
    function pointerUp(event) {
      if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) { down = null; return; }
      down = null;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickable)[0];
      if (hit) { align(hit.object.userData.bookId); latest.current.onSelect(hit.object.userData.bookId); }
    }
    function pointerCancel() { down = null; }
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerCancel);
    return () => {
      disposed = true;
      engine.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      window.removeEventListener('wheel', wheel); window.removeEventListener('scroll', scroll);
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerCancel);
      geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    };
  }, [signature]);

  useEffect(() => { engine.current?.align(selected.id); }, [selected.id, signature]);
  function move(direction) {
    const index = books.findIndex(book => book.id === selected.id);
    onSelect(books[(index + direction + books.length) % books.length].id);
  }
  return <section className="orbit" aria-label="Book carousel" aria-roledescription="carousel" aria-describedby="orbit-help" tabIndex={0}
    onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); } }}>
    <div ref={host} className="orbit-stage"/>
    {unavailable ? <div className="orbit-fallback">{selected.cover ? <img src={selected.cover} alt={`${selected.title} cover`}/> : <p>{selected.title}</p>}</div> : null}
    <button className="orbit-arrow previous icon-button" aria-label="Previous book" disabled={books.length < 2} onClick={() => move(-1)}><CaretLeft size={28} weight="thin"/></button>
    <button className="orbit-arrow next icon-button" aria-label="Next book" disabled={books.length < 2} onClick={() => move(1)}><CaretRight size={28} weight="thin"/></button>
    <div className="orbit-caption" id="orbit-help"><span className="orbit-scroll-hint"><ArrowDown size={12}/> SCROLL TO EXPLORE</span><span className="orbit-keyboard-hint">USE ARROW KEYS TO EXPLORE</span><span>CLICK A BOOK TO SELECT</span></div>
  </section>;
}
