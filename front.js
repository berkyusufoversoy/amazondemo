/* Front layer of the homepage: everything that sits on top of the film.
   Lenis smooth scroll · hero line reveal · pinned work-area panel · best-seller drag rail ·
   tilt and magnetic hovers · scroll-drawn timeline · business rows that light up · liquid-glass maps. */
(() => {
  document.documentElement.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const {gsap, ScrollTrigger, SplitText} = window;
  if (!gsap) return;
  gsap.registerPlugin(ScrollTrigger, SplitText);

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({lerp:.11, wheelMultiplier:.9, anchors:{offset:-96}});
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToEl = el => lenis ? lenis.scrollTo(el, {offset:-96}) : el.scrollIntoView({behavior:reduce ? 'auto' : 'smooth'});

  /* ---------- hero: the headline rises line by line once the fonts are in ---------- */
  document.fonts.ready.then(() => {
    if (reduce) return;
    const split = SplitText.create('.hero-title .line', {type:'lines,chars', mask:'lines', charsClass:'char'});
    if (finePointer) liquidType(split.chars);
    gsap.timeline({defaults:{ease:'expo.out'}})
      .from(split.lines, {yPercent:110, duration:1.25, stagger:.12})
      .from('.hero .lead, .hero .search, .hero .popular', {y:16, autoAlpha:0, duration:.9, stagger:.08}, '-=.85')
      .from('.tools li', {y:20, autoAlpha:0, duration:.8, stagger:.06}, '-=.7');
  });

  ScrollTrigger.create({trigger:'.hero', start:'bottom 85%', end:'max', toggleClass:{targets:document.body, className:'past-hero'}});

  /* Liquid type: under the cursor the heavy line thins and the ultralight line swells — Archivo's weight
     axis does the work, so letters reflow like a material being pressed rather than scaling as images. */
  function liquidType(chars) {
    const hero = document.querySelector('.hero');
    const items = chars.map(el => {const light = !!el.closest('em'); return {el, base:light ? 300 : 800, peak:light ? 760 : 430, w:light ? 300 : 800};});
    let px = -1e4, py = -1e4, active = false;
    hero.addEventListener('pointermove', e => {px = e.clientX; py = e.clientY; active = true;});
    hero.addEventListener('pointerleave', () => {active = false;});
    gsap.ticker.add(() => {
      let moving = false;
      for (const it of items) {
        let target = it.base;
        if (active) {const r = it.el.getBoundingClientRect(), d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2)); target = it.base + (it.peak - it.base) * Math.exp(-(d * d) / (2 * 120 * 120));}
        const next = it.w + (target - it.w) * .16;
        if (Math.abs(next - it.w) > .3) {it.w = next; it.el.style.fontVariationSettings = `'wght' ${it.w.toFixed(1)}, 'wdth' 125`; moving = true;}
      }
      return moving;
    });
  }

  /* ---------- header: which section am I in ---------- */
  const navLinks = [...document.querySelectorAll('.site-header nav a')];
  navLinks.forEach(a => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) ScrollTrigger.create({trigger:target, start:'top 50%', end:'bottom 50%', toggleClass:{targets:a, className:'is-current'}});
  });

  /* ---------- work areas: one pinned panel, the scroll step in the middle of the screen picks the slide ---------- */
  const slides = new Map([...document.querySelectorAll('.slide')].map(s => [s.dataset.slide, s]));
  const indexLinks = [...document.querySelectorAll('.theatre-index a')];
  const titleSplits = new Map();
  document.fonts.ready.then(() => slides.forEach((s, id) => titleSplits.set(id, SplitText.create(s.querySelector('.slide-title'), {type:'lines,words,chars', mask:'lines', linesClass:'ln'}))));
  let current = [...slides.keys()][0];
  function showSlide(id) {
    if (!slides.has(id) || id === current) return;
    const prev = slides.get(current), next = slides.get(id);
    current = id;
    prev.classList.remove('is-active'); prev.inert = true;
    const reel = document.querySelector('.odo-reel'), n = [...slides.keys()].indexOf(id);
    if (reel) reel.style.transform = `translateY(${-n}em)`;
    next.classList.add('is-active'); next.inert = false;
    indexLinks.forEach(a => a.dataset.go === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
    if (reduce) return;
    const split = titleSplits.get(id);
    if (split) gsap.fromTo(split.chars, {yPercent:110}, {yPercent:0, duration:.9, ease:'expo.out', stagger:.025, overwrite:true});
    gsap.fromTo(next.querySelectorAll('.slide-line, .slide-gear, .stds > *'), {y:14, autoAlpha:0}, {y:0, autoAlpha:1, duration:.7, ease:'expo.out', stagger:.035, delay:.15, overwrite:true});
    gsap.fromTo(next.querySelectorAll('.slide-shop li, .slide-shop .text-link'), {x:28, autoAlpha:0, filter:'blur(6px)'}, {x:0, autoAlpha:1, filter:'blur(0px)', duration:.8, ease:'expo.out', stagger:.06, delay:.1, overwrite:true, clearProps:'filter'});
  }
  const stepObserver = new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting && showSlide(e.target.dataset.sector)), {rootMargin:'-50% 0px -50% 0px'});
  document.querySelectorAll('.theatre-steps .step').forEach(s => stepObserver.observe(s));
  indexLinks.forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const step = document.getElementById(`sector-${a.dataset.go}`);
    if (lenis) lenis.scrollTo(step, {offset:0}); else step.scrollIntoView({behavior:reduce ? 'auto' : 'smooth'});
  }));

  /* ---------- best sellers: drag with momentum (mouse), native swipe on touch, arrow buttons ---------- */
  const rail = document.querySelector('.rail');
  if (rail) {
    const [prevBtn, nextBtn] = document.querySelectorAll('.rail-btn');
    const state = () => {prevBtn.disabled = rail.scrollLeft < 4; nextBtn.disabled = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 4;};
    rail.addEventListener('scroll', state, {passive:true}); state();
    [prevBtn, nextBtn].forEach(b => b.addEventListener('click', () => rail.scrollBy({left:Number(b.dataset.dir) * rail.clientWidth * .8, behavior:reduce ? 'auto' : 'smooth'})));
    let down = false, moved = 0, lastX = 0, lastT = 0, vel = 0, raf = 0;
    rail.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = 0; lastX = e.clientX; lastT = performance.now(); vel = 0; gsap.killTweensOf(rail);
      rail.setPointerCapture(e.pointerId);
    });
    rail.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - lastX, now = performance.now();
      moved += Math.abs(dx);
      if (moved > 4) rail.classList.add('dragging');
      rail.scrollLeft -= dx;
      vel = dx / Math.max(1, now - lastT); lastX = e.clientX; lastT = now;
    });
    const release = () => {
      if (!down) return;
      down = false;
      const project = (v, d = .998) => v / 1000 * d / (1 - d);          // px/s → resting offset
      const cards = [...rail.children], pad = parseFloat(getComputedStyle(rail).scrollPaddingLeft) || 0;
      const resting = rail.scrollLeft - project(vel * 1000);
      const snap = cards.map(c => c.offsetLeft - pad).reduce((a, b) => Math.abs(b - resting) < Math.abs(a - resting) ? b : a, 0);
      const target = Math.max(0, Math.min(snap, rail.scrollWidth - rail.clientWidth));
      gsap.to(rail, {scrollLeft:target, duration:reduce ? 0 : .75, ease:'expo.out', overwrite:true, onComplete:() => rail.classList.remove('dragging')});
    };
    rail.addEventListener('pointerup', release); rail.addEventListener('pointercancel', release);
    rail.addEventListener('click', e => {if (moved > 6) {e.preventDefault(); e.stopPropagation();}}, true);
    rail.addEventListener('keydown', e => {if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {e.preventDefault(); rail.scrollBy({left:(e.key === 'ArrowRight' ? 1 : -1) * 300, behavior:'smooth'});}});
  }

  /* ---------- tilt (category tiles, spotlight) and magnetic buttons: pointer-driven, eased, mouse only ---------- */
  if (finePointer && !reduce) {
    document.querySelectorAll('.tilt').forEach(el => {
      gsap.set(el, {transformPerspective:900});
      const rx = gsap.quickTo(el, 'rotationX', {duration:.6, ease:'power3.out'}), ry = gsap.quickTo(el, 'rotationY', {duration:.6, ease:'power3.out'});
      el.addEventListener('pointermove', e => {const r = el.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - .5) * 7); rx(-((e.clientY - r.top) / r.height - .5) * 7);});
      el.addEventListener('pointerleave', () => {rx(0); ry(0);});
    });
    document.querySelectorAll('.magnetic').forEach(el => {
      const x = gsap.quickTo(el, 'x', {duration:.5, ease:'power3.out'}), y = gsap.quickTo(el, 'y', {duration:.5, ease:'power3.out'});
      el.addEventListener('pointermove', e => {const r = el.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * .18); y((e.clientY - r.top - r.height / 2) * .28);});
      el.addEventListener('pointerleave', () => {x(0); y(0);});
    });
  }

  /* ---------- story timeline draws with scroll; business rows light up as they pass the middle ---------- */
  const line = document.querySelector('.timeline-line i');
  if (line && !reduce) {
    line.style.setProperty('--p', 0);
    ScrollTrigger.create({trigger:'.timeline-wrap', start:'top 70%', end:'bottom 55%', scrub:.6, onUpdate:s => line.style.setProperty('--p', s.progress.toFixed(3))});
  }
  document.querySelectorAll('.biz-list li').forEach(li => {
    if (reduce) {li.classList.add('is-lit'); return;}
    ScrollTrigger.create({trigger:li, start:'top 68%', end:'bottom 32%', toggleClass:'is-lit'});
  });

  /* ---------- liquid glass: per-element refraction maps for the search pill and the film caption ---------- */
  // Chromium can run SVG filters on the backdrop. The map pushes samples inward along the pill's rim,
  // so the film bends at the edges like light through a thick lens; the middle stays clear.
  const chromium = !!(navigator.userAgentData && navigator.userAgentData.brands.some(b => /Chromium/.test(b.brand)));
  function liquid(el, id, strength) {
    const filter = document.getElementById(id); if (!filter) return;
    const build = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight); if (!w || !h) return;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), r = h / 2, bevel = Math.min(h * .42, 26);
      const sdf = (x, y) => {const qx = Math.abs(x - w / 2) - (w / 2 - r), qy = Math.abs(y - h / 2) - (h / 2 - r); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;};
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d = -sdf(x + .5, y + .5), i = (y * w + x) * 4;
        let dx = 0, dy = 0;
        if (d > 0 && d < bevel) {
          const k = Math.pow(1 - d / bevel, 2);
          const nx = sdf(x + 1.5, y + .5) - sdf(x - .5, y + .5), ny = sdf(x + .5, y + 1.5) - sdf(x + .5, y - .5), l = Math.hypot(nx, ny) || 1;
          dx = -nx / l * k; dy = -ny / l * k;
        }
        img.data[i] = 128 + dx * 127; img.data[i + 1] = 128 + dy * 127; img.data[i + 2] = 128; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const fe = filter.querySelector('feImage');
      fe.setAttribute('href', c.toDataURL()); fe.setAttribute('width', w); fe.setAttribute('height', h);
      filter.querySelector('feDisplacementMap').setAttribute('scale', strength);
    };
    build(); new ResizeObserver(build).observe(el);
    el.style.backdropFilter = el.style.webkitBackdropFilter = `url(#${id}) blur(3px) saturate(1.6) brightness(1.05)`;
    el.classList.add('is-liquid');
  }
  if (chromium && !matchMedia('(prefers-reduced-transparency: reduce)').matches) {
    const search = document.querySelector('.search.liquid'), caption = document.querySelector('.film-caption.liquid');
    if (search) liquid(search, 'liquid-0', 38);
    if (caption) liquid(caption, 'liquid-1', 26);
  }

  /* ---------- viewfinder: the reticle follows the crew the camera holds on; the caption runs a timecode ---------- */
  const reticle = document.querySelector('.reticle'), tc = document.querySelector('.film-caption .tc');
  if (reticle && !reduce) {
    const roleEl = reticle.querySelector('.r-role'), nEl = reticle.querySelector('.r-n');
    const qx = gsap.quickTo(reticle, 'x', {duration:.5, ease:'power3.out'}), qy = gsap.quickTo(reticle, 'y', {duration:.5, ease:'power3.out'});
    let shown = false, key = '', lastTc = '';
    gsap.ticker.add(() => {
      const h = window.__filmHUD; if (!h) return;
      const inHero = !document.body.classList.contains('past-hero');
      // In the hero the headline owns the left half; lock on only to crews on the right there.
      const want = h.on && h.role && (!inHero || h.x > .55) && h.x > .04 && h.x < .96 && h.y > .12 && h.y < .9;
      if (want) {
        const X = h.x * innerWidth, Y = h.y * innerHeight, k = h.scene + h.k;
        if (!shown || k !== key) {
          gsap.set(reticle, {x:X, y:Y});
          roleEl.textContent = h.role; nEl.textContent = `Ekip ${String(h.k + 1).padStart(2, '0')} / ${String(h.n).padStart(2, '0')}`;
          reticle.classList.toggle('flip', h.x > .72);
          reticle.classList.remove('locked'); void reticle.offsetWidth;
          key = k;
        } else {qx(X); qy(Y);}
        reticle.classList.add('locked');
      } else if (shown) reticle.classList.remove('locked');
      shown = want;
      if (tc) {
        const t = h.time, str = [Math.floor(t / 60), Math.floor(t % 60), Math.floor((t % 1) * 25)].map(n => String(n).padStart(2, '0')).join(':');
        if (str !== lastTc) {tc.textContent = str; lastTc = str;}
      }
    });
  }

  /* ---------- sections settle into place as they arrive (scale + lift, scrubbed with the scroll) ---------- */
  if (!reduce) document.querySelectorAll('.sheet, .brands, .story').forEach(el => {
    gsap.fromTo(el, {scale:.94, y:36}, {scale:1, y:0, ease:'none', scrollTrigger:{trigger:el, start:'top bottom', end:'top 58%', scrub:.6}});
  });

  /* ---------- work-area progress line ---------- */
  const prog = document.querySelector('.stage-progress i');
  if (prog) ScrollTrigger.create({trigger:'.theatre', start:'top top', end:'bottom bottom', onUpdate:st => prog.style.setProperty('--p', st.progress.toFixed(4))});

  /* ---------- 360° turntable: scroll turns the jacket while the section is pinned; drag to turn it yourself ---------- */
  // Photographic frames at known (uneven) angles; between two neighbours the newer view dissolves in over a
  // short window, so the turn reads continuous without ghosting for long.
  const tt = document.querySelector('.turntable');
  if (tt) {
    const meta = JSON.parse(tt.dataset.frames), canvas = tt.querySelector('.turn-canvas'), ctx = canvas.getContext('2d');
    const mix = document.createElement('canvas'), mctx = mix.getContext('2d');
    const imgs = meta.map(m => {const im = new Image(); im.decoding = 'async'; im.src = 'assets/turntable/' + m.file; return im;});
    const ticks = [...tt.querySelectorAll('.platter line')].map(el => ({el, base:Number(el.dataset.tick)}));
    const degEl = tt.querySelector('.turn-deg'), platter = tt.querySelector('.platter');
    let ready = false, scrollAngle = 0, drag = 0, idle = 0, last = -1, lastW = 0, lastH = 0, inView = false;
    const norm = a => ((a % 360) + 360) % 360;
    const smooth = (e0, e1, x) => {const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t);};
    function pair(a) {
      a = norm(a);
      for (let i = 0; i < meta.length; i++) {
        const j = (i + 1) % meta.length, a0 = meta[i].angle, a1 = j ? meta[j].angle : 360;
        if (a >= a0 && a < a1) return [i, j, smooth(.38, .62, (a - a0) / (a1 - a0))];
      }
      return [0, 1, 0];
    }
    function draw(angle) {
      const r = tt.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2), cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (cw !== lastW || ch !== lastH) {canvas.width = mix.width = Math.round(cw * dpr); canvas.height = mix.height = Math.round(ch * dpr); lastW = cw; lastH = ch;}
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cw, ch);
      // Stand the jacket on the platter: frame baseline (96% of the frame) sits on the platter's centre line.
      const p = platter.getBoundingClientRect(), c = canvas.getBoundingClientRect();
      const floor = p.top - c.top + p.height * .5, cx = p.left - c.left + p.width / 2;
      const h = Math.min(floor * 1.02, ch * .9), w = h * .82, x = cx - w / 2, y = floor - h * .96;
      const [i, j, t] = pair(angle);
      if (t < .001 || t > .999) ctx.drawImage(imgs[t > .5 ? j : i], x, y, w, h);
      else {
        // Cross-dissolve additively: where both views cover the jacket, weights sum to one and it stays
        // opaque; only the slightly different outlines blend. (A plain alpha mix makes it see-through.)
        mctx.setTransform(dpr, 0, 0, dpr, 0, 0); mctx.globalCompositeOperation = 'source-over'; mctx.globalAlpha = 1; mctx.clearRect(0, 0, cw, ch);
        mctx.globalCompositeOperation = 'lighter';
        mctx.globalAlpha = 1 - t; mctx.drawImage(imgs[i], x, y, w, h);
        mctx.globalAlpha = t; mctx.drawImage(imgs[j], x, y, w, h);
        ctx.drawImage(mix, 0, 0, cw, ch);
      }
      // Platter ticks travel round the ellipse with the jacket; the near side is bright, the far side fades.
      const view = norm(angle);
      for (const k of ticks) {
        const th = (k.base - view) * Math.PI / 180, sx = Math.sin(th), cz = Math.cos(th);
        const x1 = 350 + 318 * sx, y1 = 70 + 52 * cz, x2 = 350 + 300 * sx, y2 = 70 + 49 * cz;
        k.el.setAttribute('x1', x1.toFixed(1)); k.el.setAttribute('y1', y1.toFixed(1)); k.el.setAttribute('x2', x2.toFixed(1)); k.el.setAttribute('y2', y2.toFixed(1));
        k.el.style.opacity = (.12 + .88 * (cz + 1) / 2).toFixed(2);
      }
      degEl.textContent = String(Math.round(view) % 360).padStart(3, '0') + '°';
    }
    Promise.all(imgs.map(im => im.decode().catch(() => {}))).then(() => {ready = true; tt.classList.add('ready'); last = -1;});
    new IntersectionObserver(e => {inView = e[0].isIntersecting;}).observe(tt);
    gsap.ticker.add((time, dt) => {
      if (!ready || !inView) return;
      // Where the section isn't pinned (narrow screens), let it turn slowly by itself while visible.
      if (!pinned && !reduce && !tt.classList.contains('dragging')) idle += dt * .012;
      const angle = scrollAngle + drag + idle;
      if (Math.abs(angle - last) > .05 || canvas.clientWidth !== lastW || canvas.clientHeight !== lastH) {draw(angle); last = angle;}
    });
    let pinned = false;
    const mm = gsap.matchMedia();
    // Scroll-driven only where the turntable has its own pinned track; elsewhere it turns by itself.
    if (tt.closest('.turn-track')) mm.add('(min-width: 1101px)', () => {
      pinned = true;
      const st = ScrollTrigger.create({trigger:'.turn-track', start:'top top', end:'bottom bottom', scrub:true, onUpdate:self => {scrollAngle = self.progress * 360;}});
      return () => {pinned = false; st.kill(); scrollAngle = 0;};
    });
    // Drag: 1:1 while held, then project the flick forward and settle (Apple's momentum projection).
    let down = false, lastX = 0, lastT = 0, vel = 0;
    tt.addEventListener('pointerdown', e => {
      if (e.button) return;
      down = true; lastX = e.clientX; lastT = performance.now(); vel = 0; gsap.killTweensOf(state);
      tt.setPointerCapture(e.pointerId); tt.classList.add('dragging', 'touched');
    });
    tt.addEventListener('pointermove', e => {
      if (!down) return;
      const now = performance.now(), dx = e.clientX - lastX;
      drag += dx * .45; state.drag = drag; vel = dx * .45 / Math.max(1, now - lastT) * 1000; lastX = e.clientX; lastT = now;
    });
    const state = {drag:0};
    const release = () => {
      if (!down) return;
      down = false; tt.classList.remove('dragging');
      const d = .995, target = drag + vel / 1000 * d / (1 - d);
      state.drag = drag;
      gsap.to(state, {drag:target, duration:reduce ? 0 : 1.1, ease:'expo.out', onUpdate:() => {drag = state.drag;}});
    };
    tt.addEventListener('pointerup', release); tt.addEventListener('pointercancel', release);
    tt.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); tt.classList.add('touched');
      state.drag = drag; gsap.to(state, {drag:drag + (e.key === 'ArrowRight' ? 30 : -30), duration:reduce ? 0 : .5, ease:'power3.out', onUpdate:() => {drag = state.drag;}});
    });
  }

  /* ---------- PPE set: nine pieces fly in toe-to-head and lock into an empty, inflated suit ---------- */
  const fig = document.querySelector('.ppe-figure');
  if (fig) {
    const canvasEl = fig.querySelector('.ppe-canvas'), final = fig.querySelector('.ppe-final');
    const layers = [...fig.querySelectorAll('.ppe-layer')], rows = [...document.querySelectorAll('.ppe-copy .zones li')];
    const pctEl = fig.querySelector('.ppe-pct'), countEl = fig.querySelector('.ppe-count'), tag = fig.querySelector('.ppe-tag');
    const info = Object.fromEntries((window.__ppe || []).map(z => [z.id, z]));
    const order = ['trousers', 'boots', 'jacket', 'harness', 'gloves', 'respirator', 'goggles', 'helmet', 'earmuffs'];
    // Start offsets as fractions of the figure (x of width, y of height); paired items split left/right.
    const EX = {trousers:{y:.12}, boots:{x:.1, y:.2, r:8}, jacket:{y:-.05}, harness:{y:.03, s:1.18}, gloves:{x:.22, y:.05, r:14},
      respirator:{y:-.07, s:1.22}, goggles:{y:-.13, s:1.12}, helmet:{y:-.24, r:-7}, earmuffs:{x:.18, y:-.18, r:9}};
    const side = el => el.dataset.half === 'l' ? -1 : el.dataset.half === 'r' ? 1 : 0;
    const from = el => {const e = EX[el.dataset.ppe] || {}, k = side(el); return {
      x:() => (e.x || 0) * k * canvasEl.clientWidth, y:() => (e.y || 0) * canvasEl.clientHeight,
      rotation:(e.r || 0) * (k || 1), scale:e.s || 1, autoAlpha:0};};
    const STEP = .55, DUR = 1;
    const tl = gsap.timeline({paused:true, defaults:{ease:'power3.inOut'}});
    order.forEach((id, i) => {
      const els = layers.filter(l => l.dataset.ppe === id);
      els.forEach(el => tl.fromTo(el, from(el), {x:0, y:0, rotation:0, scale:1, autoAlpha:1, duration:DUR}, i * STEP));
    });
    const landed = i => i * STEP + DUR;
    tl.to(final, {autoAlpha:1, duration:.7, ease:'power2.out'}, landed(order.length - 1) - .1);
    const sync = () => {
      const t = tl.time(); let n = 0;
      order.forEach((id, i) => {const on = t >= landed(i) - .05; if (on) n++; rows.find(r => r.dataset.ppe === id)?.classList.toggle('is-on', on);});
      pctEl.textContent = Math.round(tl.progress() * 100) + '%';
      countEl.textContent = n + ' / 9 parça';
      fig.classList.toggle('done', tl.progress() > .97);
    };
    tl.eventCallback('onUpdate', sync);
    const mm = gsap.matchMedia();
    if (reduce) {tl.progress(1); sync();}
    else {
      mm.add('(min-width: 1101px)', () => {
        const st = ScrollTrigger.create({trigger:'.ppe-track', start:'top top', end:'bottom bottom', scrub:.6, invalidateOnRefresh:true, animation:tl});
        return () => st.kill();
      });
      mm.add('(max-width: 1100px)', () => {
        const st = ScrollTrigger.create({trigger:fig, start:'top 70%', once:true, onEnter:() => tl.duration(4.2).play(0)});
        return () => st.kill();
      });
    }
    // Hover a zone: that piece stays, the rest of the suit steps back, and a tag names the product.
    const hot = id => {
      fig.classList.toggle('has-hot', !!id);
      layers.forEach(l => l.classList.toggle('is-hot', l.dataset.ppe === id));
      rows.forEach(r => r.classList.toggle('is-hot', r.dataset.ppe === id));
      const z = info[id], el = layers.find(l => l.dataset.ppe === id && l.dataset.half !== 'l') || layers.find(l => l.dataset.ppe === id);
      if (!z || !el) {tag.classList.remove('show'); return;}
      const box = el.dataset.box.split(',').map(Number), w = canvasEl.clientWidth, h = canvasEl.clientHeight;
      const c = canvasEl.getBoundingClientRect(), f2 = fig.getBoundingClientRect();
      tag.innerHTML = `<span class="product-brand">${z.zone}</span><b>${z.product}</b><span class="price">${z.price}</span>`;
      tag.style.left = (c.left - f2.left + (box[0] + box[2]) / 100 * w + 14) + 'px';
      tag.style.top = (c.top - f2.top + (box[1] + box[3] / 2) / 100 * h) + 'px';
      tag.classList.add('show');
    };
    rows.forEach(r => {
      r.addEventListener('pointerenter', () => hot(r.dataset.ppe)); r.addEventListener('pointerleave', () => hot(''));
      r.addEventListener('focusin', () => hot(r.dataset.ppe)); r.addEventListener('focusout', () => hot(''));
    });
  }

  window.__front = {lenis, showSlide};
})();
