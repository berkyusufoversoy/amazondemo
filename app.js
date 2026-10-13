import * as THREE from './vendor/three.module.js';

/* ------------------------------------------------------------------------------------------
   Amazon İş Market — Working Worlds background film
   The journey plays by itself behind the homepage at a slow, steady pace; the page scrolls over it.
   When a sector row reaches the middle of the screen, the film cuts to that sector's workplaces and
   loops them until the reader moves on. One WebGL pipeline renders it:
   · aerial layer   — the river/road-preserving forest → industry → city morph (photographic)
   · scene layer    — each workplace is filmed, not shown: the camera holds on one crew, then
                      travels across the plate to the next (depth parallax), and rack-focuses
                      into the next workplace — no blur, no whip pans
   · dives          — aerial → workplace builds from the farthest surfaces; back out nearest-first
   · bridge         — one construction shot; only the structural regions change state
   Without WebGL the <img> stack below is used as a plain still-image presentation.
------------------------------------------------------------------------------------------- */

const stage = document.querySelector('.film'), canvas = document.querySelector('#landscape-canvas');
const images = [...document.querySelectorAll('.scene-image')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const debug = new URLSearchParams(location.search).has('debug');
const IMAGE_ASPECT = 1672 / 941;

/* Camera stops: x/y = the subject's position on the plate (0–1, y downwards), z = framing (1 = whole plate). */
const scenes = {
  forest:    {image:'forest', aerial:true, name:'DOĞA', title:'Her koşulda.<br><em>Yanınızda.</em>', kicker:'ÇALIŞMANIN DOĞASINDA VAR', description:'İş kıyafetleri ve koruyucu donanımlar.<br>İşiniz sizi nereye götürürse.', world:0},
  forestry:  {image:'forestry', name:'ORMANCILIK', title:'Zorlu işlere.<br><em>Güçlü donanım.</em>', kicker:'DOĞANIN İÇİNDE ÇALIŞANLARA', description:'Göz ve kulak koruyucular · Eldivenler · İş kıyafetleri', world:0, dive:[.70,.55], sector:'forestry',
    stops:[{x:.17, y:.52, z:1.42, role:'Motorlu testere operatörü'}, {x:.52, y:.34, z:1.36, role:'Hasat makinesi operatörü'}, {x:.84, y:.50, z:1.42, role:'Konveyör operatörü'}]},
  industry:  {image:'industry', aerial:true, name:'ENDÜSTRİ', title:'Üretimin gücüne<br><em>eşlik ediyoruz.</em>', kicker:'ÜRETİMİN HER ANINDA', description:'Yağmurda, gece vardiyasında, ağır sanayide.<br>Çalışma alanınıza uygun donanımlar.', world:1},
  antistatic:{image:'antistatic', name:'PROSES', title:'Kontrol sizde.<br><em>İşe uygun donanım.</em>', kicker:'PROSES VE ÜRETİM', description:'Antistatik iş kıyafetleri · Eldivenler · İş ayakkabıları', world:1, dive:[.63,.50], sector:'process',
    stops:[{x:.20, y:.40, z:1.40, role:'Vana teknisyeni'}, {x:.49, y:.46, z:1.55, role:'Kontrol paneli'}, {x:.80, y:.44, z:1.40, role:'Pompa bakım teknisyeni'}]},
  foundry:   {image:'foundry', name:'DÖKÜMHANE', title:'Sıcağın içinde.<br><em>İşinizin başında.</em>', kicker:'ISIYA KARŞI DONANIM', description:'Isıya dayanıklı kıyafetler · Yüz koruyucular · Termal eldivenler', world:1, sector:'foundry',
    stops:[{x:.20, y:.45, z:1.40, role:'Döküm operatörü'}, {x:.60, y:.32, z:1.30, role:'Pota dökümü'}, {x:.84, y:.46, z:1.42, role:'Kalıp hattı'}]},
  steel:     {image:'steel', name:'ÇELİK İMALATI', title:'Çeliğe şekil<br><em>verenlere.</em>', kicker:'AĞIR İŞİN USTALARI', description:'Kaynak ve yüz koruyucular · Eldivenler · İş kıyafetleri', world:1, sector:'steel',
    stops:[{x:.36, y:.38, z:1.40, role:'Kaynakçı'}, {x:.66, y:.58, z:1.55, role:'Hat operatörü'}, {x:.87, y:.48, z:1.42, role:'Taşlama operatörü'}]},
  assembly:  {image:'assembly', name:'OTOMOTİV', title:'Her detayda.<br><em>Aynı özen.</em>', kicker:'HASSAS ÜRETİM', description:'Koruyucu gözlükler · Montaj eldivenleri · İş ayakkabıları', world:1, sector:'automotive',
    stops:[{x:.14, y:.38, z:1.42, role:'Montaj teknisyeni'}, {x:.40, y:.46, z:1.30, role:'Gövde hattı'}, {x:.86, y:.42, z:1.42, role:'Kalite kontrol'}]},
  turbine:   {image:'turbine', name:'AĞIR MAKİNE', title:'Büyük işler.<br><em>Sağlam ekipler.</em>', kicker:'GÜCÜ BİRLİKTE KURUYORUZ', description:'Baretler · Eldivenler · Yüksek görünürlüklü iş kıyafetleri', world:1, sector:'machinery',
    stops:[{x:.27, y:.38, z:1.40, role:'Tork ekibi'}, {x:.60, y:.40, z:1.28, role:'Türbin rotoru'}, {x:.84, y:.45, z:1.42, role:'Hizalama teknisyeni'}]},
  city:      {image:'city', aerial:true, name:'İNŞAAT', title:'Yarını birlikte<br><em>inşa ederken.</em>', kicker:'YARINI KURANLARIN YANINDAYIZ', description:'Şantiyede, yüksekte, her yeni projede.<br>İşinize uygun koruyucu ekipmanlar.', world:2},
  bridge:    {image:'bridge-lift', bridge:true, name:'KÖPRÜ', title:'Her aşamada.<br><em>Birlikte.</em>', kicker:'YARINI TAŞIYAN EKİPLER', description:'Baretler · Koruyucu gözlükler · Eldivenler · İş botları', world:2, dive:[.55,.62], sector:'construction',
    stops:[{x:.86, y:.55, z:1.42, role:'Vinç işaretçisi'}, {x:.55, y:.30, z:1.30, role:'Segment kaldırma'}, {x:.17, y:.60, z:1.42, role:'Tabliye montaj ekibi'}]},
  bridgeDeck:{image:'bridge-deck', name:'KÖPRÜ', title:'Her aşamada.<br><em>Birlikte.</em>', kicker:'YARINI TAŞIYAN EKİPLER', description:'Baretler · Koruyucu gözlükler · Eldivenler · İş botları', world:2, dive:[.55,.62], sector:'construction',
    stops:[{x:.12, y:.45, z:1.40, role:'Vinç işaretçisi'}, {x:.47, y:.30, z:1.25, role:'Segment yerleştirme'}, {x:.42, y:.62, z:1.42, role:'Mesnet montajı'}]},
  bridgePier:{image:'bridge-pier', enter:'down', name:'KÖPRÜ', title:'Temelden<br><em>tabliyeye.</em>', kicker:'AYAKLARIN DİBİNDE', description:'Baretler · İş botları · Eldivenler · Yüksek görünürlüklü kıyafetler', world:2, sector:'construction',
    stops:[{x:.33, y:.36, z:1.30, role:'Beton kovası'}, {x:.27, y:.70, z:1.45, role:'Yük yönlendirme'}, {x:.66, y:.68, z:1.40, role:'Beton ekibi'}]},
  bridgeBarge:{image:'bridge-barge', enter:'down', name:'KÖPRÜ', title:'Nehrin<br><em>üzerinde.</em>', kicker:'SUDA, HER KOŞULDA', description:'Can yelekleri üzerinde KKD · Eldivenler · Kaynak koruyucuları · İş botları', world:2, sector:'construction',
    stops:[{x:.40, y:.30, z:1.25, role:'Segment kaldırma'}, {x:.13, y:.66, z:1.45, role:'Halat ekibi'}, {x:.31, y:.60, z:1.45, role:'Vinç operatörü'}, {x:.43, y:.74, z:1.45, role:'Kaynakçı'}]},
  bridgeWide:{image:'bridge-wide', name:'KÖPRÜ', title:'Her seviyede.<br><em>Aynı güven.</em>', kicker:'TABLİYEDEN NEHRE', description:'Şantiyenin her katmanı için iş kıyafetleri ve koruyucu donanımlar.', world:2, sector:'construction',
    stops:[{x:.50, y:.52, z:1.02, role:''}, {x:.55, y:.45, z:1.32, role:'Segment kaldırma'}]},
  forestryCab:{image:'forestry-cab', name:'ORMANCILIK', title:'Kabinde de<br><em>aynı güven.</em>', kicker:'HASAT MAKİNESİNDE', description:'Kulak koruyucular · Koruyucu gözlükler · Yüksek görünürlüklü kıyafetler', world:0, sector:'forestry', stops:[{x:.38, y:.42, z:1.25, role:'Kesme kafası'}, {x:.80, y:.40, z:1.40, role:'Hasat makinesi operatörü'}]},
  forestryDeck:{image:'forestry-deck', name:'ORMANCILIK', title:'Kütükten<br><em>kerestehaneye.</em>', kicker:'KÜTÜK SAHASINDA', description:'Kesilmeye dayanıklı eldivenler · Baretler · İş botları', world:0, sector:'forestry', stops:[{x:.22, y:.42, z:1.40, role:'Kütük yönlendirme'}, {x:.50, y:.30, z:1.42, role:'Konveyör ekibi'}, {x:.80, y:.30, z:1.42, role:'Hat sonu'}]},
  processControl:{image:'process-control', name:'PROSES', title:'Ekranın başında<br><em>da sahada.</em>', kicker:'KONTROL ODASINDA', description:'Antistatik iş kıyafetleri · Koruyucu gözlükler', world:1, sector:'process', stops:[{x:.24, y:.45, z:1.35, role:'Proses operatörleri'}, {x:.66, y:.40, z:1.30, role:'Tesis görünümü'}]},
  processWalkway:{image:'process-walkway', enter:'up', name:'PROSES', title:'Yüksekte,<br><em>topraklı ve güvende.</em>', kicker:'ÜST PLATFORMDA', description:'Antistatik kıyafetler · Emniyet kemerleri · Eldivenler', world:1, sector:'process', stops:[{x:.56, y:.32, z:1.35, role:'Numune alma'}, {x:.84, y:.70, z:1.40, role:'Topraklama ve destek'}]},
  foundryTap:{image:'foundry-tap', name:'DÖKÜMHANE', title:'Ocak ağzında<br><em>tam koruma.</em>', kicker:'OCAK BOŞALTMA', description:'Alüminize kıyafetler · Yüz siperleri · Isıya dayanıklı eldivenler', world:1, sector:'foundry', stops:[{x:.15, y:.40, z:1.40, role:'Sıcaklık ölçümü'}, {x:.55, y:.36, z:1.28, role:'Ocak boşaltma'}, {x:.92, y:.30, z:1.50, role:'Kumanda platformu'}]},
  foundryFinish:{image:'foundry-finish', name:'DÖKÜMHANE', title:'Dökümden<br><em>son rötuşa.</em>', kicker:'TAŞLAMA ATÖLYESİ', description:'Yüz siperleri · Solunum koruyucular · Deri önlükler · Eldivenler', world:1, sector:'foundry', stops:[{x:.40, y:.38, z:1.35, role:'Döküm taşlama'}, {x:.90, y:.40, z:1.45, role:'Finisaj'}]},
  steelCrane:{image:'steel-crane', enter:'up', name:'ÇELİK İMALATI', title:'Yük havadayken<br><em>herkes yerinde.</em>', kicker:'TAVAN VİNCİ', description:'Baretler · Yüksek görünürlüklü yelekler · Eldivenler · İş botları', world:1, sector:'steel', stops:[{x:.50, y:.40, z:1.25, role:'Kiriş kaldırma'}, {x:.12, y:.50, z:1.40, role:'Vinç işaretçisi'}, {x:.90, y:.68, z:1.45, role:'Kılavuz halat'}]},
  steelPlasma:{image:'steel-plasma', name:'ÇELİK İMALATI', title:'Milimetrik<br><em>kesim.</em>', kicker:'PLAZMA KESİM', description:'Koruyucu gözlükler · Kulak koruyucular · Kaynak eldivenleri', world:1, sector:'steel', stops:[{x:.40, y:.45, z:1.35, role:'Montajcı'}, {x:.86, y:.62, z:1.40, role:'Plazma kesim'}]},
  autoRobots:{image:'auto-robots', name:'OTOMOTİV', title:'Robotların yanında<br><em>insan dikkati.</em>', kicker:'ROBOTİK KAYNAK HÜCRESİ', description:'Koruyucu gözlükler · Kesilmeye dayanıklı eldivenler · İş ayakkabıları', world:1, sector:'automotive', stops:[{x:.35, y:.30, z:1.30, role:'Robotik kaynak'}, {x:.86, y:.40, z:1.40, role:'Hücre teknisyeni'}]},
  autoInspect:{image:'auto-inspect', name:'OTOMOTİV', title:'Son kontrolde<br><em>kusursuzluk.</em>', kicker:'KALİTE TÜNELİ', description:'Montaj eldivenleri · Koruyucu gözlükler · İş kıyafetleri', world:1, sector:'automotive', stops:[{x:.52, y:.38, z:1.35, role:'Boya kontrolü'}, {x:.80, y:.45, z:1.28, role:'Yüzey denetimi'}]},
  machineryRotor:{image:'machinery-rotor', enter:'up', name:'AĞIR MAKİNE', title:'Tonlarca yük.<br><em>Tek bir ekip.</em>', kicker:'ROTOR YERLEŞTİRME', description:'Baretler · Emniyet kemerleri · Yüksek görünürlüklü kıyafetler', world:1, sector:'machinery', stops:[{x:.50, y:.40, z:1.25, role:'Rotor indirme'}, {x:.15, y:.30, z:1.45, role:'Platformdaki ekip'}, {x:.92, y:.72, z:1.45, role:'Vinç işaretçisi'}]},
  machineryAlign:{image:'machinery-align', name:'AĞIR MAKİNE', title:'Mikronlarla<br><em>hizalama.</em>', kicker:'LAZER HİZALAMA', description:'Kulak koruyucular · Koruyucu gözlükler · Eldivenler', world:1, sector:'machinery', stops:[{x:.40, y:.35, z:1.35, role:'Kaplin hizalama'}, {x:.88, y:.45, z:1.40, role:'Ölçüm kontrolü'}]},
  rooftopEdge:{image:'rooftop-edge', name:'BAKIM', title:'Kenarda bile<br><em>bağlı ve güvende.</em>', kicker:'ÇATI KENARINDA', description:'Emniyet kemerleri · Lanyardlar · Baretler · İş botları', world:2, sector:'maintenance', stops:[{x:.32, y:.45, z:1.35, role:'Ankraj bağlantısı'}, {x:.70, y:.55, z:1.30, role:'Şehir ve köprü'}]},
  rooftopMast:{image:'rooftop-mast', enter:'up', name:'BAKIM', title:'Yükseldikçe<br><em>güven artar.</em>', kicker:'DİREK TIRMANIŞI', description:'Paraşüt tipi emniyet kemerleri · Düşüş durdurucular · Baretler', world:2, sector:'maintenance', stops:[{x:.68, y:.35, z:1.40, role:'Direk tırmanışı'}, {x:.50, y:.75, z:1.40, role:'Emniyet desteği'}]},
  rooftop:   {image:'rooftop', name:'BAKIM', title:'Hayatı çalışır<br><em>tutanlara.</em>', kicker:'İNŞADAN BAKIMA', description:'İş kıyafetleri · Yüksekte çalışma donanımları · İş ayakkabıları', world:2, sector:'maintenance',
    stops:[{x:.21, y:.44, z:1.42, role:'İklimlendirme teknisyeni'}, {x:.55, y:.32, z:1.25, role:'Şehir ve köprü'}, {x:.88, y:.48, z:1.42, role:'Güneş paneli bakımı'}]}
};

/* Beat timing in journey units. A workplace's hold is made of dwells (one per crew) and the camera
   moves between them; every beat then hands over during `trans`. */
const DWELL = .42, MOVE = .36, TRANS = .38;
const beats = [
  {scene:'forest', from:0, to:0, hold:.7},
  {scene:'forestry'}, {scene:'forestryCab'}, {scene:'forestryDeck'},
  {scene:'industry', from:0, to:1, hold:1.05},
  {scene:'antistatic'}, {scene:'processControl'}, {scene:'processWalkway'}, {scene:'foundry'}, {scene:'foundryTap'}, {scene:'foundryFinish'}, {scene:'steel'}, {scene:'steelCrane'}, {scene:'steelPlasma'}, {scene:'assembly'}, {scene:'autoRobots'}, {scene:'autoInspect'}, {scene:'turbine'}, {scene:'machineryRotor'}, {scene:'machineryAlign'},
  {scene:'city', from:1, to:2, hold:1.05},
  {scene:'bridgeDeck'}, {scene:'bridgePier'}, {scene:'bridgeBarge'}, {scene:'bridgeWide'},
  {scene:'rooftop'}, {scene:'rooftopEdge'}, {scene:'rooftopMast'},
  {scene:'forest', from:2, to:0, hold:1.1, finale:true}
].map((b, i, all) => {
  const s = scenes[b.scene], n = s.stops ? s.stops.length : 0;
  const hold = b.hold ?? n * DWELL + (n - 1) * MOVE;
  return {...b, hold, trans:i === all.length - 1 ? 0 : TRANS};
});
let cursor = 0; beats.forEach(b => {b.start = cursor; cursor += b.hold + b.trans;});
const totalUnits = cursor;

/* Film clock: journey units per second. Crew dwells play at this pace; camera moves and hand-overs
   run faster so they still read as camera moves rather than slow dissolves. */
const FILM_RATE = .138, MOVE_BOOST = 1, TRANS_BOOST = 1.5, CUT_SECONDS = 2.2;
const sectorRanges = {};
beats.forEach((b, i) => {const k = scenes[b.scene].sector; if (!k || b.finale) return; const r = sectorRanges[k] ||= {first:i, last:i}; r.first = Math.min(r.first, i); r.last = Math.max(r.last, i);});
const film = {u:0, lock:null, cut:null, time:0};
/* What the camera is looking at, for the front layer's viewfinder: the crew's on-screen position while the
   camera holds on them (null while it travels or hands over), plus a running film clock. */
const hud = window.__filmHUD = {on:false, x:.5, y:.5, role:'', k:0, n:0, scene:'', time:0};

let dirty = true, ready = false, renderer = null, aerialUniforms, sceneUniforms, aerialScene, detailScene, camera;
let progress = 0, shownRole = '', visible = true, covered = false;
let paused = reducedMotion.matches, lastFrame = 0, pointer = {x:0, y:0, tx:0, ty:0}, bridgeReady = false;
const textures = {}, pending = {};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => {const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t);};
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeSine = t => .5 - Math.cos(Math.PI * clamp(t)) * .5;                 // gentle start and stop, no snap
const easeInOutVel = t => t < .5 ? 12 * t * t : 12 * Math.pow(1 - t, 2);   // derivative of easeInOut

/* ---------- journey state ---------- */
function locate(p) {
  const u = clamp(p) * totalUnits;
  let i = beats.length - 1;
  for (let k = 0; k < beats.length; k++) if (u < beats[k].start + beats[k].hold + beats[k].trans) {i = k; break;}
  const b = beats[i], within = u - b.start;
  const hold = clamp(within / b.hold), t = b.trans ? clamp((within - b.hold) / b.trans) : 0;
  return {i, b, within, hold, t, next:beats[i + 1]};
}

/* Where the camera is inside a workplace: which crew, whether it is travelling, and how fast. */
function track(name, within) {
  const s = scenes[name], n = s.stops.length;
  let k = 0, x = clamp(within, 0, n * DWELL + (n - 1) * MOVE);
  while (k < n - 1 && x > DWELL + MOVE) {x -= DWELL + MOVE; k++;}
  if (x <= DWELL || k === n - 1) return {k, from:s.stops[k], to:s.stops[k], m:0, vel:0, dwell:clamp(x / DWELL)};
  const m = (x - DWELL) / MOVE;
  return {k, from:s.stops[k], to:s.stops[k + 1], m:easeSine(m), vel:0, dwell:1};
}

function windowSize(zoom) {
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  const portrait = aspect < IMAGE_ASPECT;
  const z = portrait ? 1 + (zoom - 1) * .35 : zoom;            // phones already see a narrow slice
  return portrait ? [aspect / IMAGE_ASPECT / z, 1 / z] : [1 / z, IMAGE_ASPECT / aspect / z];
}
/* Frame a subject so it sits clear of the caption card (card bottom-left on desktop, bottom on phones). */
function frameStop(x, y, zoom) {
  const size = windowSize(zoom), portrait = stage.clientWidth / stage.clientHeight < IMAGE_ASPECT;
  const target = portrait ? [.5, .38] : [.6, .46];
  const cx = clamp(x - (target[0] - .5) * size[0], size[0] / 2, 1 - size[0] / 2);
  const cy = clamp(y - (target[1] - .5) * size[1], size[1] / 2, 1 - size[1] / 2);
  return new THREE.Vector4(cx, 1 - cy, size[0], size[1]);      // texture space is y-up
}
function viewFor(name, within, exit = 0) {
  const s = scenes[name];
  if (!s.stops) return {view:frameStop(.5, .5, 1), cam:new THREE.Vector4(), role:'', state:0, k:0};
  const T = track(name, within), lerp = (a, b) => a + (b - a) * T.m;
  const view = frameStop(lerp(T.from.x, T.to.x), lerp(T.from.y, T.to.y), lerp(T.from.z, T.to.z));
  const drift = T.dwell - .5;
  const cam = new THREE.Vector4(.022 * T.dwell + .03 * exit, .006 * drift + pointer.x * .005, -.003 * drift + pointer.y * .003, 0);
  let state = 0;
  if (s.bridge) {
    // Construction follows the camera: lifted while it pans to the crane, completed while it watches.
    const n = s.stops.length, span = n * DWELL + (n - 1) * MOVE;
    state = clamp((within - DWELL * .6) / (DWELL + MOVE + DWELL * .9 - DWELL * .6)) * (within < span ? 1 : 1);
    if (within >= span) state = 1;
  }
  return {view, cam, role:T.m > .5 ? T.to.role : T.from.role, state, k:T.k, n:s.stops.length, moving:T.from !== T.to,
    subject:{x:lerp(T.from.x, T.to.x), y:lerp(T.from.y, T.to.y)}};
}

// Caption: "03 / 08  Dökümhane · Pota dökümü" for workplaces, the world name for aerials.
const SECTOR_ORDER = ['forestry', 'process', 'foundry', 'steel', 'automotive', 'machinery', 'construction', 'maintenance'];
const sentence = t => { const l = t.toLocaleLowerCase('tr'); return l.charAt(0).toLocaleUpperCase('tr') + l.slice(1); };
function showCaption(beat, role) {
  const s = scenes[beat.scene], n = SECTOR_ORDER.indexOf(s.sector) + 1;
  const name = sentence(s.name);
  const label = n ? `<b>${String(n).padStart(2, '0')}</b><span class="of"> / 08</span>${name}${role ? ` · ${role}` : ''}` : name;
  if (label === shownRole) return;
  shownRole = label;
  const el = document.querySelector('#world-name');
  if (window.gsap && !reducedMotion.matches) {
    gsap.killTweensOf(el);
    gsap.to(el, {opacity:0, y:-4, duration:.16, ease:'power2.in', onComplete:() => {el.innerHTML = label; gsap.to(el, {opacity:1, y:0, duration:.4, ease:'expo.out'});}});
  } else el.innerHTML = label;
}

function update(value) {
  progress = clamp(value);
  const L = locate(progress);
  const showing = L.t > .5 ? L.next : L.b;
  const role = scenes[showing.scene].stops ? viewFor(showing.scene, showing === L.b ? L.within : 0).role : '';
  showCaption(film.cut ? beats[film.cut.to] : showing, film.cut ? '' : role);
  [L.b, L.next, beats[L.i + 2], film.cut && beats[film.cut.to]].forEach(b => b && requestScene(b.scene));
  if (ready) dirty = true; else presentStill(L);
}

/* ---------- fallback presentation (no WebGL) ---------- */
function presentStill(L) {
  const from = scenes[L.b.scene].image, to = L.next ? scenes[L.next.scene].image : from;
  images.forEach(img => {
    const src = img.dataset.src || img.getAttribute('src');
    if (src.includes(`/${from}.webp`) || src.includes(`/${to}.webp`)) {if (!img.getAttribute('src')) img.src = img.dataset.src;}
    const o = src.includes(`/${to}.webp`) && L.t > 0 ? L.t : src.includes(`/${from}.webp`) ? 1 - L.t : 0;
    img.style.opacity = String(o);
  });
}

/* ---------- textures ---------- */
const bitmapLoader = typeof createImageBitmap === 'function' ? new THREE.ImageBitmapLoader().setOptions({imageOrientation:'flipY', premultiplyAlpha:'none'}) : null;
const loader = new THREE.TextureLoader();
function loadTexture(path, color = true) {
  // ImageBitmap decoding happens off the main thread; the texture is uploaded right away (initTexture)
  // so the GPU never has to stall mid-transition to receive a plate.
  const load = bitmapLoader ? bitmapLoader.loadAsync(path).then(b => {const t = new THREE.Texture(b); t.flipY = false; t.needsUpdate = true; return t;}) : loader.loadAsync(path);
  return load.then(t => {
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    if (color) {t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;}   // mips power the rack-focus hand-over
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    if (renderer) {renderer.initTexture(t); lastUpload = performance.now();}
    return t;
  });
}
function requestScene(name) {
  if (!renderer || !sceneUniforms || textures[name] || pending[name]) return;
  const s = scenes[name];
  if (s.aerial) return;
  const jobs = s.bridge
    ? [loadTexture('assets/bridge-lift.webp'), loadTexture('assets/depth/bridge-lift.webp', false), loadTexture('assets/bridge-before.webp'), loadTexture('assets/bridge-complete.webp'), loadTexture('assets/depth/bridge-mask.webp', false)]
    : [loadTexture(`assets/${s.image}.webp`), loadTexture(`assets/depth/${s.image}.webp`, false)];
  pending[name] = Promise.all(jobs).then(list => {
    textures[name] = {color:list[0], depth:list[1]};
    if (s.bridge) {
      sceneUniforms.uBridgeBefore.value = list[2]; sceneUniforms.uBridgeComplete.value = list[3]; sceneUniforms.uBridgeMask.value = list[4];
      bridgeReady = true;
    }
    update(progress);
  }).catch(() => {delete pending[name];});
}

/* ---------- rendering ---------- */
function setSlot(slot, name, v) {
  const tex = textures[name];
  sceneUniforms[`uTex${slot}`].value = tex ? tex.color : placeholder;
  sceneUniforms[`uDepth${slot}`].value = tex ? tex.depth : placeholder;
  sceneUniforms[`uView${slot}`].value.copy(v.view);
  sceneUniforms[`uCam${slot}`].value.copy(v.cam);
  sceneUniforms[`uReady${slot}`].value = tex ? 1 : 0;
  sceneUniforms[`uBridge${slot}`].value = scenes[name].bridge && bridgeReady ? 1 : 0;
  sceneUniforms[`uBridgeState${slot}`].value = v.state;
}
const worldVec = w => [w > 0 ? 1 : 0, w === 2 ? 1 : 0];
function setAerial(beat, hold, zoom, focus) {
  const from = worldVec(beat.from ?? scenes[beat.scene].world), to = worldVec(beat.to ?? scenes[beat.scene].world);
  const w = smooth(.12, .82, hold);
  // City → forest finale: drop the industrial layer at once and dissolve the city back into the rainforest.
  aerialUniforms.uIndustry.value = beat.finale ? 0 : from[0] + (to[0] - from[0]) * w;
  aerialUniforms.uCity.value = beat.finale ? 1 - w : from[1] + (to[1] - from[1]) * w;
  aerialUniforms.uZoom.value = reducedMotion.matches ? 0 : zoom;
  if (focus) aerialUniforms.uZoomFocus.value.set(focus[0], focus[1]);
  aerialUniforms.uJourney.value = progress;
}

// Project the crew's plate position through the framing window and the depth lens onto the screen.
function aim(v, scene) {
  const {view, cam, subject} = v, k = cam.x * .85;
  const px = subject.x, py = 1 - subject.y;
  const ux = view.x + (px + cam.y * .08 - view.x) * (1 + k), uy = view.y + (py + cam.z * .08 - view.y) * (1 + k);
  Object.assign(hud, {on:true, x:(ux - view.x) / view.z + .5, y:1 - ((uy - view.y) / view.w + .5), role:v.role, k:v.k, n:v.n, scene});
}
function renderFrame(L) {
  hud.on = false;
  const cur = scenes[L.b.scene], nxt = L.next && scenes[L.next.scene];
  let aerialOn = false, mode = 0, t = L.t;
  if (film.cut) {
    // Steered cut to a sector: dive from the aerial, or whip-pan from the workplace on screen.
    const c = film.cut, to = beats[c.to].scene;
    t = c.t;
    if (scenes[c.from.scene].aerial) {
      aerialOn = true; mode = 2;
      setAerial(c.from, c.hold, easeInOut(t) * .55, scenes[to].dive || [.6, .5]);
    } else {
      mode = 4;
      setSlot('A', c.from.scene, viewFor(c.from.scene, c.within, easeSine(t)));
    }
    setSlot('B', to, viewFor(to, 0));
    if (mode === 4) settle(t);
  } else if (L.t <= 0 || !nxt) {
    if (cur.aerial) {aerialOn = true; mode = -1; setAerial(L.b, L.hold, 0);}
    else {const v = viewFor(L.b.scene, L.within); setSlot('A', L.b.scene, v); if (!v.moving && L.t <= 0) aim(v, L.b.scene);}
  } else if (cur.aerial && !nxt.aerial) {
    // Dive: the aerial pushes towards where the next crew works; their workplace builds from the back.
    aerialOn = true; mode = 2;
    setAerial(L.b, 1, easeInOut(t) * .55, nxt.dive || [.6, .5]);
    setSlot('B', L.next.scene, viewFor(L.next.scene, 0));
  } else if (!cur.aerial && nxt.aerial) {
    // Pull back: the workplace clears nearest-first and reveals the world from above.
    aerialOn = true; mode = 3;
    setAerial(L.next, 0, (1 - easeInOut(t)) * .55, cur.dive || [.6, .5]);
    setSlot('A', L.b.scene, viewFor(L.b.scene, L.b.hold + 1, t));
  } else {
    // Hand-over: a rack focus while the camera eases forward and the next shot settles back.
    // No sideways sweep, no smear.
    mode = 4;
    setSlot('A', L.b.scene, viewFor(L.b.scene, L.b.hold + 1, easeSine(t)));
    setSlot('B', L.next.scene, viewFor(L.next.scene, 0));
    settle(t);
  }
  sceneUniforms.uMode.value = mode;
  sceneUniforms.uT.value = mode === 4 ? easeSine(t) : t;
  draw(aerialOn, mode !== -1);
}
function settle(t) {sceneUniforms.uCamB.value.x += .045 * (1 - easeSine(t));}
let placeholder;
function draw(aerialOn, detailOn) {
  if (!ready || !visible) return;
  renderer.clear();
  if (aerialOn) renderer.render(aerialScene, camera);
  if (detailOn) renderer.render(detailScene, camera);
}

/* The film clock. Dwells play at FILM_RATE, camera moves and hand-overs faster; a sector lock loops the
   film inside that sector's workplaces, cutting back to its first one instead of travelling on. */
function startCut(to) {
  const L = locate(progress);
  const holdingNext = L.t > .5 && L.next;
  const from = holdingNext ? L.next : L.b, within = holdingNext ? 0 : L.within;
  if (!ready || paused || reducedMotion.matches) {film.cut = null; film.u = beats[to].start + DWELL * .5; return;}
  film.cut = {from, within, hold:holdingNext ? 0 : L.hold, to, t:0};
}
function advance(dt) {
  if (film.cut) {
    if (!textures[beats[film.cut.to].scene]) return;                 // wait for the plate before cutting to it
    film.cut.t += dt / CUT_SECONDS;
    if (film.cut.t >= 1) {film.u = beats[film.cut.to].start; film.cut = null;}
    return;
  }
  const L = locate(film.u / totalUnits), s = scenes[L.b.scene];
  const moving = L.t > 0 ? TRANS_BOOST : s.stops && track(L.b.scene, L.within).from !== track(L.b.scene, L.within).to ? MOVE_BOOST : 1;
  film.u += dt * FILM_RATE * moving;
  if (film.u >= totalUnits) film.u -= totalUnits;                     // the finale ends on the opening aerial
  checkLock();
}
function checkLock() {
  if (!film.lock || film.cut) return;
  const r = sectorRanges[film.lock], i = locate(film.u / totalUnits).i, last = beats[r.last];
  if (i < r.first || i > r.last || film.u >= last.start + last.hold) startCut(r.first);
}
/* Frame pacing. The film renders on every display frame up to ~60 fps (a 120/144 Hz screen skips frames).
   Only sustained slowness counts — one long frame (a plate decoding, a tab switch) is clipped before it
   is averaged. Can't hold 60: drop to 30. Can't hold 30 either: render fewer pixels (the plates are soft
   photographs; it barely shows). Every few seconds the faster setting is tried again, backing off when it fails. */
const pace = {avg:16.7, cap:13, scale:1, probeAt:0, wait:4000, since:0, slow:0};
let rescale = () => {}, lastUpload = 0;                 // frames right after a plate upload don't count
function retune(gap, time) {
  pace.avg += (Math.min(gap, 50) - pace.avg) * .05;
  if (pace.cap < 30) {
    if (pace.avg > 22) {pace.cap = 30; pace.avg = 33.3; pace.probeAt = time + pace.wait; pace.wait = Math.min(pace.wait * 2, 64000);}
    else if (time - pace.since > 8000) {
      pace.wait = 4000; pace.since = time;
      if (pace.scale < 1 && pace.avg < 18) {pace.scale += .25; rescale();}
    }
  } else if (pace.avg > 40) {
    if (pace.scale > .5) {pace.scale -= .25; rescale(); pace.avg = 33.3; pace.slow = 0;}
    else if (!pace.slow) pace.slow = time;
    else if (time - pace.slow > 4000) goLite('the film cannot hold 25 fps on this machine');
  } else {
    pace.slow = 0;
    if (time > pace.probeAt && pace.avg < 36) {pace.cap = 13; pace.avg = 16.7; pace.since = time;}
  }
}
/* Lite: no GPU to spare (software rendering, or a GPU that can't carry the film). The still photographs
   take over — they still change with the sector being read — and frosted glass becomes tinted glass,
   because backdrop blur over a full page is the most expensive thing a software compositor can be asked. */
function goLite(reason) {
  document.documentElement.classList.add('lite');
  if (renderer) renderer.setAnimationLoop(null);
  ready = false; hud.on = false; stage.classList.remove('webgl'); canvas.style.opacity = '0';
  const scan = document.querySelector('#scan-toggle'); if (scan) scan.style.display = 'none';
  console.info('Lite presentation:', reason);
  update(progress);
}
function tick(time) {
  const gap = time - lastFrame;
  if (!ready || document.hidden || gap < (covered ? 30 : pace.cap)) return;
  lastFrame = time;
  // The film clock follows real time down to 4 fps, so a slow machine sees the same film, just choppier.
  const dt = Math.min(gap, 250) * .001, playing = !paused && !reducedMotion.matches;
  if (playing) {
    advance(dt);
    film.time += dt; hud.time = film.time;
    aerialUniforms.uTime.value += dt; sceneUniforms.uTime.value += dt;
    pointer.x += (pointer.tx - pointer.x) * .06; pointer.y += (pointer.ty - pointer.y) * .06;
    dirty = true;
  }
  if (dirty) update(film.u / totalUnits);
  if (dirty) {
    dirty = false; renderFrame(locate(progress));
    if (!covered && playing && time - lastUpload > 300) retune(gap, time);
  }
}

const NOISE = `
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
  float fbm(vec2 p){return noise(p)*.55+noise(p*2.3)*.3+noise(p*5.1)*.15;}`;

const sceneShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexA,uDepthA,uTexB,uDepthB,uBridgeBefore,uBridgeComplete,uBridgeMask;
  uniform vec4 uViewA,uViewB,uCamA,uCamB;
  uniform float uReadyA,uReadyB,uBridgeA,uBridgeB,uBridgeStateA,uBridgeStateB,uMode,uT,uTime,uAspect,uScan,uScanPos;
  // Depth scan: the plate's depth map read as a LiDAR survey — iso-depth contours (orange near, steel-blue
  // far), silhouette edges where depth jumps, the photograph dimmed underneath; revealed by a sweep line.
  // Depth maps are 8-bit and low-res: smooth them over a small disc before tracing, or contours stair-step.
  float scanDepth(sampler2D depth,vec4 view){
    vec2 uv=view.xy+(vUv-.5)*view.zw,o=vec2(.0026,.0026*uAspect)*view.zw*1.6;
    float d=textureLod(depth,uv,0.).r*4.;
    d+=textureLod(depth,uv+vec2(o.x,0.),0.).r*2.+textureLod(depth,uv-vec2(o.x,0.),0.).r*2.+textureLod(depth,uv+vec2(0.,o.y),0.).r*2.+textureLod(depth,uv-vec2(0.,o.y),0.).r*2.;
    d+=textureLod(depth,uv+o,0.).r+textureLod(depth,uv-o,0.).r+textureLod(depth,uv+vec2(o.x,-o.y),0.).r+textureLod(depth,uv+vec2(-o.x,o.y),0.).r;
    return d/16.;
  }
  vec3 scanned(vec3 c,float d){
    float g=d*20.,w=fwidth(g),line=1.-smoothstep(0.,1.5*w,abs(fract(g-.5)-.5));
    float edge=smoothstep(.35,1.,fwidth(d)*34.);
    vec3 tint=mix(vec3(.42,.46,.95),vec3(1.,.42,.1),smoothstep(.35,.95,d));
    vec3 base=c*.14+vec3(.016,.02,.028)+tint*.06*d;
    return base+tint*line*(.3+.7*d)+vec3(.92,.94,.97)*edge*.36;
  }
  vec3 applyScan(vec3 c,float d){
    if(uScan<.001)return c;
    float y=1.-vUv.y,reveal=1.-smoothstep(uScanPos-.004,uScanPos+.004,y);
    float glow=exp(-pow((y-uScanPos)/.006,2.))*step(.001,uScanPos)*(1.-step(1.02,uScanPos));
    return mix(c,scanned(c,d),reveal*uScan)+vec3(.984,.337,.027)*glow*uScan*.9;
  }
  ${NOISE}
  vec2 lens(sampler2D depth,vec2 uv,vec4 cam,vec2 c){
    // Depth-aware camera: nearer surfaces magnify and shift more than distant ones.
    vec2 p=uv;float d=texture2D(depth,p).r;
    for(int i=0;i<2;i++){p=c+(uv-c)/(1.+cam.x*(.35+d))-cam.yz*(d-.42);d=textureLod(depth,clamp(p,.001,.999),0.).r;}
    return clamp(p,.001,.999);
  }
  vec3 bridge(vec3 lift,vec2 p,float d,float state){
    // One shot, three construction states. Only the hoist and deck regions change, sweeping upward
    // like the lift itself; the crew (near depth) and the rest of the plate stay untouched.
    vec2 m=texture2D(uBridgeMask,p).rg*(1.-smoothstep(.36,.52,d));
    float rise1=smoothstep(.0,.45,state),rise2=smoothstep(.55,1.,state),edge=.07,height=1.-p.y;
    float line1=mix(1.05,.25,rise1),line2=mix(1.05,.25,rise2);
    float passed1=smoothstep(line1-edge,line1+edge,height),passed2=smoothstep(line2-edge,line2+edge,height);
    vec3 c=mix(lift,texture2D(uBridgeBefore,p).rgb,m.r*(1.-passed1*step(.001,rise1)));
    return mix(c,texture2D(uBridgeComplete,p).rgb,m.g*passed2*step(.001,rise2));
  }
  vec3 tapA(vec2 s,out float d){vec2 uv=uViewA.xy+(s-.5)*uViewA.zw;vec2 p=lens(uDepthA,uv,uCamA,uViewA.xy);vec4 dd=texture2D(uDepthA,p);d=dd.g;vec3 c=texture2D(uTexA,p).rgb;return uBridgeA>.5?bridge(c,p,dd.r,uBridgeStateA):c;}
  vec3 tapB(vec2 s,out float d){vec2 uv=uViewB.xy+(s-.5)*uViewB.zw;vec2 p=lens(uDepthB,uv,uCamB,uViewB.xy);vec4 dd=texture2D(uDepthB,p);d=dd.g;vec3 c=texture2D(uTexB,p).rgb;return uBridgeB>.5?bridge(c,p,dd.r,uBridgeStateB):c;}
  vec3 shadeA(vec2 s,out float d){
    if(uReadyA<.5){d=0.;return vec3(.129,.145,.161);}
    return tapA(s,d);
  }
  vec3 shadeB(vec2 s,out float d){
    if(uReadyB<.5){d=0.;return vec3(.129,.145,.161);}
    return tapB(s,d);
  }
  // Defocus from the mip chain (smooth, no ghost copies), softened further with four small offset taps.
  vec3 defocus(sampler2D tex,vec2 p,float k){
    float b=k*4.6;vec2 o=vec2(.003,.003*uAspect)*k;
    return texture2D(tex,p,b).rgb*.36+(texture2D(tex,p+o,b).rgb+texture2D(tex,p-o,b).rgb+texture2D(tex,p+vec2(o.x,-o.y),b).rgb+texture2D(tex,p+vec2(-o.x,o.y),b).rgb)*.16;
  }
  vec3 softA(vec2 s,float k){float d;if(k<.02)return tapA(s,d);vec2 uv=uViewA.xy+(s-.5)*uViewA.zw;return defocus(uTexA,lens(uDepthA,uv,uCamA,uViewA.xy),k);}
  vec3 softB(vec2 s,float k){float d;if(k<.02)return tapB(s,d);vec2 uv=uViewB.xy+(s-.5)*uViewB.zw;return defocus(uTexB,lens(uDepthB,uv,uCamB,uViewB.xy),k);}
  void main(){
    float dA=0.;
    vec4 o;
    if(uMode<.5){vec3 c=shadeA(vUv,dA);o=vec4(uScan>.001?applyScan(c,scanDepth(uDepthA,uViewA)):c,1.);}
    else if(uMode<2.5){
      // Arriving from above: while the aerial pushes in, the workplace resolves out of soft focus.
      float k=1.-smoothstep(.25,1.,uT),w=smoothstep(.2,.75,uT);
      vec3 b=uReadyB>.5?softB(vUv,k):vec3(.129,.145,.161);
      o=vec4(b,w*uReadyB);
    }
    else if(uMode<3.5){
      // Pulling back to the aerial: the workplace softens and lets the world from above through.
      float k=smoothstep(0.,.75,uT),w=1.-smoothstep(.25,.8,uT);
      vec3 a=uReadyA>.5?softA(vUv,k):vec3(.129,.145,.161);
      o=vec4(a,w);
    }
    else{
      // Workplace to workplace: a rack focus. The current shot softens, the next one resolves out of
      // the same softness; the swap happens while both are out of focus, so nothing slides or flashes.
      float r=sin(3.14159*uT),w=smoothstep(.3,.7,uT);
      vec3 a=uReadyA>.5?softA(vUv,r):vec3(.129,.145,.161),b=uReadyB>.5?softB(vUv,r):vec3(.129,.145,.161);
      vec3 m=mix(a,b,w);
      o=vec4(uScan>.001?applyScan(m,mix(scanDepth(uDepthA,uViewA),scanDepth(uDepthB,uViewB),w)):m,1.);
    }
    gl_FragColor=o;
    #include <colorspace_fragment>
  }`;

async function setupRenderer() {
  try {
    renderer = new THREE.WebGLRenderer({canvas, alpha:false, antialias:false, powerPreference:'high-performance'});
    const gl = renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    if (/swiftshader|basic render|llvmpipe|softpipe|software/i.test(gpu)) {renderer.dispose(); renderer = null; goLite('software WebGL (' + gpu + ')'); return;}
    const basePixelRatio = innerWidth < 760 ? Math.min(devicePixelRatio, 1.5) : 1;
    renderer.setPixelRatio(basePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.autoClear = false;
    renderer.setClearColor(0x212529, 1);
    placeholder = new THREE.DataTexture(new Uint8Array([33, 37, 41, 255]), 1, 1); placeholder.needsUpdate = true;

    const aerialTex = await Promise.all(['forest', 'industry', 'city', 'forest-clear'].map(n => loadTexture(`assets/${n}.webp`)));
    const paths = {
      forest:[[0,.414,.623],[.10,.405,.600],[.20,.351,.551],[.30,.284,.477],[.40,.243,.391],[.47,.263,.497],[.52,.343,.591],[.57,.488,.665],[.63,.643,.758],[.68,.591,.729],[.72,.530,.630],[.76,.525,.580],[.80,.585,.671],[.83,.589,.632],[.87,.600,.620],[1,.600,.620]],
      industry:[[0,.394,.606],[.10,.386,.590],[.20,.340,.540],[.30,.282,.469],[.40,.242,.390],[.47,.276,.477],[.52,.350,.570],[.57,.475,.654],[.63,.614,.727],[.68,.577,.701],[.72,.526,.611],[.76,.522,.573],[.80,.573,.655],[.83,.582,.626],[.87,.600,.620],[1,.600,.620]],
      city:[[0,.275,.697],[.10,.312,.656],[.20,.357,.616],[.30,.381,.604],[.40,.256,.561],[.47,.247,.640],[.52,.367,.718],[.57,.520,.738],[.63,.540,.714],[.68,.557,.688],[.72,.528,.634],[.76,.519,.578],[.80,.573,.653],[.83,.584,.628],[.87,.600,.620],[1,.600,.620]]
    };
    const pathData = new Uint8Array(1024 * 3 * 4);
    ['forest', 'industry', 'city'].forEach((name, row) => {
      for (let y = 0; y < 1024; y++) {
        const position = y / 1023, path = paths[name]; let segment = 0;
        while (segment < path.length - 2 && position > path[segment + 1][0]) segment++;
        const a = path[segment], b = path[segment + 1], k = (position - a[0]) / (b[0] - a[0]);
        const left = Math.round((a[1] + (b[1] - a[1]) * k) * 65535), right = Math.round((a[2] + (b[2] - a[2]) * k) * 65535);
        pathData.set([left >> 8, left & 255, right >> 8, right & 255], (row * 1024 + y) * 4);
      }
    });
    const pathMap = new THREE.DataTexture(pathData, 1024, 3, THREE.RGBAFormat); pathMap.needsUpdate = true;
    pathMap.minFilter = THREE.NearestFilter; pathMap.magFilter = THREE.NearestFilter;

    aerialUniforms = {uForest:{value:aerialTex[0]}, uForestClear:{value:aerialTex[3]}, uIndustryMap:{value:aerialTex[1]}, uCityMap:{value:aerialTex[2]}, uPathMap:{value:pathMap},
      uIndustry:{value:0}, uCity:{value:0}, uJourney:{value:0}, uZoom:{value:0}, uZoomFocus:{value:new THREE.Vector2(.72, .52)}, uTime:{value:0}, uAspect:{value:1}, uImageAspect:{value:IMAGE_ASPECT}};
    const v4 = () => ({value:new THREE.Vector4()});
    sceneUniforms = {uTexA:{value:placeholder}, uDepthA:{value:placeholder}, uTexB:{value:placeholder}, uDepthB:{value:placeholder},
      uBridgeBefore:{value:placeholder}, uBridgeComplete:{value:placeholder}, uBridgeMask:{value:placeholder},
      uViewA:v4(), uViewB:v4(), uCamA:v4(), uCamB:v4(),
      uReadyA:{value:0}, uReadyB:{value:0}, uBridgeA:{value:0}, uBridgeB:{value:0}, uBridgeStateA:{value:0}, uBridgeStateB:{value:0},
      uMode:{value:0}, uT:{value:0}, uTime:{value:0}, uAspect:{value:1}, uScan:{value:0}, uScanPos:{value:0}};

    const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    const aerialMaterial = new THREE.ShaderMaterial({uniforms:aerialUniforms, depthTest:false, depthWrite:false, vertexShader, fragmentShader:AERIAL_SHADER});
    const sceneMaterial = new THREE.ShaderMaterial({uniforms:sceneUniforms, depthTest:false, depthWrite:false, transparent:true, vertexShader, fragmentShader:sceneShader});
    camera = new THREE.Camera();
    aerialScene = new THREE.Scene(); aerialScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), aerialMaterial));
    detailScene = new THREE.Scene(); detailScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), sceneMaterial));

    const resize = () => {
      renderer.setSize(stage.clientWidth, stage.clientHeight, false);
      aerialUniforms.uAspect.value = sceneUniforms.uAspect.value = stage.clientWidth / stage.clientHeight;
      update(progress);
    };
    // Compile both programs before going live (in parallel, off the main thread, where the browser offers
    // KHR_parallel_shader_compile); the still images stay up meanwhile, so the page never freezes on it.
    await Promise.all([renderer.compileAsync(aerialScene, camera), renderer.compileAsync(detailScene, camera)]);
    ready = true;
    resize(); new ResizeObserver(resize).observe(stage);
    rescale = () => {renderer.setPixelRatio(basePixelRatio * pace.scale); resize();};
    stage.classList.add('webgl');
    canvas.style.opacity = '1';
    update(progress);
    renderer.setAnimationLoop(tick);
    canvas.addEventListener('webglcontextlost', e => {e.preventDefault(); ready = false; renderer.setAnimationLoop(null); stage.classList.remove('webgl'); canvas.style.opacity = '0';});
    // Preload the rest of the journey quietly, in story order.
    const order = beats.map(b => b.scene).filter(n => !scenes[n].aerial);
    (async () => {for (const n of order) {requestScene(n); await pending[n]?.catch(() => {});}})();
  } catch (error) {
    ready = false; renderer = null; canvas.style.opacity = '0'; stage.classList.remove('webgl');
    console.info('Using the still-image presentation.', error.message);
    update(progress);
  }
}

/* The aerial shader is unchanged in substance from the approved demo: shared bank geometry keeps the
   river → road → river corridor continuous, and only the photographic cloud/water residual moves. */
const AERIAL_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uForest,uForestClear,uIndustryMap,uCityMap,uPathMap;
  uniform float uIndustry,uCity,uJourney,uTime,uAspect,uImageAspect,uZoom;
  uniform vec2 uZoomFocus;
  ${NOISE}
  vec2 banks(float row,float y){vec4 data=texture2D(uPathMap,vec2(clamp(y,0.,1.),row));return vec2((data.r*256.+data.g)/257.,(data.b*256.+data.a)/257.);}
  vec3 original(vec2 uv){return texture2D(uForest,clamp(uv,vec2(.001),vec2(.999))).rgb;}
  vec3 clearPlate(vec2 uv){return texture2D(uForestClear,clamp(uv,vec2(.001),vec2(.999))).rgb;}
  vec3 cloudDelta(vec2 uv){return original(uv)-clearPlate(uv);}
  vec3 fogDelta(vec2 uv){vec3 d=cloudDelta(uv);float haze=max(min(min(d.r,d.g),d.b),0.);return vec3(haze)*smoothstep(.012,.045,haze);}
  vec3 waterDetail(vec2 uv){vec2 e=vec2(.0024,.003);vec3 mean=(original(uv+vec2(e.x,0.))+original(uv-vec2(e.x,0.))+original(uv+vec2(0.,e.y))+original(uv-vec2(0.,e.y)))*.25;return original(uv)-mean;}
  vec2 flowingUV(vec2 uv,vec2 bank,float phase){
    vec2 ahead=banks(1./6.,clamp(uv.y+.008,0.,.82)),behind=banks(1./6.,clamp(uv.y-.008,0.,.82));
    float tangent=clamp(((ahead.x+ahead.y)-(behind.x+behind.y))/.032,-2.,2.);
    float across=clamp((uv.x-bank.x)/max(bank.y-bank.x,.001),.03,.97);
    float ripple=sin(uv.y*320.-uTime*1.7+across*9.)*.00015*(1.-uv.y);
    return uv+vec2(tangent,1.)*((phase-.5)*.004)+vec2(ripple,0.);
  }
  vec3 livingForest(vec2 uv){
    vec3 still=original(uv),color=still;
    vec2 bank=banks(1./6.,uv.y);
    float water=smoothstep(bank.x+.008,bank.x+.024,uv.x)*(1.-smoothstep(bank.y-.024,bank.y-.008,uv.x))*(1.-smoothstep(.79,.84,uv.y));
    water*=1.-smoothstep(.40,.60,(still.g-still.b)/max(still.g,.001));
    if(water>.001){float a=fract(uTime/10.),b=fract(uTime/10.+.5),weight=abs(1.-2.*a);
      vec3 detail=mix(waterDetail(flowingUV(uv,bank,a)),waterDetail(flowingUV(uv,bank,b)),weight);color+=water*(detail-waterDetail(uv))*.55;}
    float a=fract(uTime/64.),b=fract(uTime/64.+.5),weight=abs(1.-2.*a);
    float sky=smoothstep(.84,.89,uv.y)*smoothstep(.035,.13,distance(uv,vec2(.084,.95)));
    if(sky>.001){float perspective=mix(.35,1.,smoothstep(.85,.99,uv.y));
      vec2 va=uv-vec2((a-.5)*.048*perspective,0.),vb=uv-vec2((b-.5)*.048*perspective,0.);
      color=mix(color,clearPlate(uv)+mix(cloudDelta(va),cloudDelta(vb),weight),sky);}
    float mist=smoothstep(.48,.66,uv.y)*(1.-smoothstep(.82,.87,uv.y))*(1.-water);
    if(mist>.001){vec2 va=uv-vec2((a-.5)*.04,0.),vb=uv-vec2((b-.5)*.04,0.);color+=mist*(mix(fogDelta(va),fogDelta(vb),weight)-fogDelta(uv));}
    return max(color,vec3(0.));
  }
  float warpX(float x,vec2 shared,vec2 source){
    if(x<shared.x)return x*source.x/max(shared.x,.001);
    if(x>shared.y)return source.y+(x-shared.y)*(1.-source.y)/max(1.-shared.y,.001);
    return source.x+(x-shared.x)*(source.y-source.x)/max(shared.y-shared.x,.001);
  }
  float materialMorph(vec2 p,float t,vec2 shared){
    if(t<.001)return 0.;if(t>.999)return 1.;
    float n=noise(p*18.)*.6+noise(p*48.)*.3+noise(p*100.)*.1;
    float local=t+(n-.5)*.11+(p.y-.5)*.04-abs(p.x-(shared.x+shared.y)*.5)*.035;
    return smoothstep(.18,.82,local);
  }
  void main(){
    vec2 p=vUv;
    if(uAspect<uImageAspect)p.x=(p.x-.5)*(uAspect/uImageAspect)+.5; else p.y=(p.y-.5)*(uImageAspect/uAspect)+.5;
    p=(p-uZoomFocus)*(1.-uZoom)+uZoomFocus;
    float depth=1.-p.y;
    p=(p-vec2(.52,.68))*(1.-uJourney*.018)+vec2(.52,.68);
    vec2 f=banks(1./6.,p.y),i=banks(.5,p.y),c=banks(5./6.,p.y);
    vec2 shared=mix(mix(f,i,uIndustry),c,uCity);
    float warpWeight=1.-smoothstep(.83,.90,p.y);
    float fx=mix(p.x,warpX(p.x,shared,f),warpWeight),ix=mix(p.x,warpX(p.x,shared,i),warpWeight),cx=mix(p.x,warpX(p.x,shared,c),warpWeight);
    float transition=sin(uIndustry*3.14159)+sin(uCity*3.14159);
    float flow=sin(p.y*29.+uTime*.18)*transition*.0009*depth;
    vec3 forest=livingForest(vec2(fx+flow,p.y));
    vec3 industry=texture2D(uIndustryMap,vec2(ix+flow,p.y)).rgb;
    vec3 city=texture2D(uCityMap,vec2(cx+flow,p.y)).rgb;
    vec3 color=mix(forest,industry,materialMorph(p,uIndustry,shared));
    color=mix(color,city,materialMorph(p,uCity,shared));
    float mist=noise(vec2(p.x*6.-uTime*.018,p.y*16.+uTime*.006));
    float fogBand=smoothstep(.50,.74,p.y)*(1.-smoothstep(.81,.89,p.y));
    color=mix(color,vec3(.71,.72,.67),pow(mist,3.)*fogBand*.045);
    // Diving in: a slight radial falloff sells the speed without blurring the photograph.
    color*=1.-uZoom*.35*smoothstep(.25,.9,distance(vUv,vec2(.5)));
    gl_FragColor=vec4(color,1.);
    #include <colorspace_fragment>
  }`;

/* ---------- page ↔ film ---------- */
// The sector row crossing the middle of the screen steers the film (after a short settle, so fast
// scrolling past several sectors does not trigger a cut for each).
let lockTimer;
const rows = [...document.querySelectorAll('[data-sector]')];
const centred = new Map();
const io = new IntersectionObserver(entries => {
  entries.forEach(e => centred.set(e.target, e.isIntersecting));
  const row = rows.find(r => centred.get(r));
  const want = row ? row.dataset.sector : null;
  clearTimeout(lockTimer);
  lockTimer = setTimeout(() => {if (want !== film.lock) {film.lock = want; checkLock(); dirty = true; if (!ready) update(film.u / totalUnits);}}, want ? 280 : 600);
}, {rootMargin:'-48% 0px -48% 0px'});
rows.forEach(r => io.observe(r));

// Opaque sections (paper sheets, story) can cover the film completely; then nothing needs drawing.
const sheets = [...document.querySelectorAll('.sheet, .story, .site-footer')];
const bands = [...document.querySelectorAll('.brands')];                            // translucent, but nothing to track under them
function measureCover() {
  const h = innerHeight;
  const rects = sheets.map(el => el.getBoundingClientRect());
  covered = rects.some(r => r.top <= 76 && r.bottom >= h);                       // under the opaque header
  document.body.classList.toggle('film-covered', rects.some(r => r.top <= 150 && r.bottom >= 92));   // caption sits on a sheet
  hud.cover = [...rects, ...bands.map(el => el.getBoundingClientRect())].map(r => [r.top, r.bottom]);   // the viewfinder hides under these
  document.querySelector('.site-header').classList.toggle('scrolled', scrollY > 40);
  if (!covered) dirty = true;
}
addEventListener('scroll', measureCover, {passive:true}); addEventListener('resize', measureCover);

// 3B tarama: a sweep line draws the depth survey down the frame; switching off sweeps it back up.
const scanState = {on:false, pos:0};
document.querySelector('#scan-toggle')?.addEventListener('click', event => {
  if (!sceneUniforms) return;
  scanState.on = !scanState.on;
  const b = event.currentTarget;
  b.setAttribute('aria-pressed', String(scanState.on));
  b.setAttribute('aria-label', scanState.on ? 'Derinlik taramasını kapat' : 'Derinlik taramasını aç');
  document.body.classList.toggle('film-scan', scanState.on);
  if (scanState.on) sceneUniforms.uScan.value = 1;
  const apply = () => {sceneUniforms.uScanPos.value = scanState.pos; dirty = true;};
  if (window.gsap && !reducedMotion.matches) gsap.to(scanState, {pos:scanState.on ? 1.05 : 0, duration:scanState.on ? 1.6 : 1.1, ease:'power2.inOut', overwrite:true, onUpdate:apply,
    onComplete:() => {if (!scanState.on) sceneUniforms.uScan.value = 0; apply();}});
  else {scanState.pos = scanState.on ? 1.05 : 0; sceneUniforms.uScan.value = scanState.on ? 1 : 0; apply();}
});
document.querySelector('#motion-toggle').addEventListener('click', event => {
  paused = !paused;
  const b = event.currentTarget;
  b.setAttribute('aria-pressed', String(paused));
  b.setAttribute('aria-label', paused ? 'Arka plan filmini oynat' : 'Arka plan filmini durdur');
  document.body.classList.toggle('film-paused', paused);
  if (paused && film.cut) {film.u = beats[film.cut.to].start + DWELL * .5; film.cut = null;}
  dirty = true;
});
addEventListener('pointermove', e => {if (e.pointerType === 'mouse') {pointer.tx = (e.clientX / innerWidth - .5) * 2; pointer.ty = (e.clientY / innerHeight - .5) * 2;}}, {passive:true});

if (reducedMotion.matches) {paused = true; document.body.classList.add('film-paused');}
reducedMotion.addEventListener('change', () => {paused = reducedMotion.matches; document.body.classList.toggle('film-paused', paused); dirty = true;});
update(0); measureCover(); setupRenderer();
if (debug) window.__journey = {film, pace, beats, totalUnits, sectorRanges, locate, redraw:() => {dirty = true;}, isReady:() => ready && Object.keys(textures).length}
