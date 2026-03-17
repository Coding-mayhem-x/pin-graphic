/*
  Honeycomb Circles Simulator (TypeScript source)
  - Centers of circles follow a triangular lattice rotated so that neighbors are vertical and at ±60°.
  - The drawing "area" has logical size 90 × 60 in units of circle diameters.
  - Radius adapts to the viewport: diameterPx = floor(min(width/90, height/60)).
  - Palette of colors is editable and stored in localStorage; you can add a random circle in selected color.
  - Circles get a high-contrast outline if fill is too close to background.
*/

type Axial = { u: number; v: number };
type Point = { x: number; y: number };
type RGB = { r: number; g: number; b: number };
type ColorEntry = { id: string; name: string; value: string };

const LS_PALETTE_KEY = 'honeycomb.palette.v1';

function parseCssColorToRgb(input: string): RGB | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  // hex #rgb or #rrggbb
  const m3 = /^#([0-9a-f]{3})$/.exec(s);
  if (m3) {
    const n = m3[1];
    return {
      r: parseInt(n[0] + n[0], 16),
      g: parseInt(n[1] + n[1], 16),
      b: parseInt(n[2] + n[2], 16),
    };
  }
  const m6 = /^#([0-9a-f]{6})$/.exec(s);
  if (m6) {
    const n = m6[1];
    return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16) };
  }
  // rgb(a)
  const mrgb = /^rgba?\(([^)]+)\)$/.exec(s);
  if (mrgb) {
    const parts = mrgb[1].split(',').map(x => x.trim());
    if (parts.length >= 3) {
      const r = Math.max(0, Math.min(255, parseFloat(parts[0])));
      const g = Math.max(0, Math.min(255, parseFloat(parts[1])));
      const b = Math.max(0, Math.min(255, parseFloat(parts[2])));
      return { r, g, b };
    }
  }
  return null;
}

function relLuminance(rgb: RGB): number {
  const srgb = [rgb.r, rgb.g, rgb.b].map(v => v / 255);
  const lin = srgb.map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(a: RGB, b: RGB): number {
  const L1 = relLuminance(a);
  const L2 = relLuminance(b);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

class PaletteManager {
  private listEl: HTMLElement;
  private selectEl: HTMLSelectElement;
  private addBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private data: ColorEntry[] = [];

  constructor() {
    this.listEl = document.getElementById('paletteList')!;
    this.selectEl = document.getElementById('paletteSelect') as HTMLSelectElement;
    this.addBtn = document.getElementById('btnPaletteAdd') as HTMLButtonElement;
    this.resetBtn = document.getElementById('btnPaletteReset') as HTMLButtonElement;

    this.addBtn.onclick = () => this.addColor();
    this.resetBtn.onclick = () => this.resetDefaults();

    this.load();
    this.renderList();
    this.renderSelect();
  }

  get selected(): ColorEntry | undefined {
    const id = this.selectEl.value;
    return this.data.find(x => x.id === id);
  }

  get colors(): ColorEntry[] { return this.data.slice(); }

  private load() {
    try {
      const raw = localStorage.getItem(LS_PALETTE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ColorEntry[];
        if (Array.isArray(parsed) && parsed.length) {
          this.data = parsed;
          return;
        }
      }
    } catch {}
    this.resetDefaults();
  }

  private save() {
    localStorage.setItem(LS_PALETTE_KEY, JSON.stringify(this.data));
    this.renderSelect();
  }

  private resetDefaults() {
    this.data = [
      { id: 'c1', name: 'Czerwony', value: '#ff2d2d' },
      { id: 'c2', name: 'Sky', value: '#60a5fa' },
      { id: 'c3', name: 'Dark Blue', value: '#1e3a8a' },
      { id: 'c4', name: 'Black', value: '#000000' },
      { id: 'c5', name: 'Red', value: '#ef4444' },
      { id: 'c6', name: 'Brown', value: '#8b5a2b' },
      { id: 'c7', name: 'Grass Green', value: '#22c55e' },
      { id: 'c8', name: 'Dark Green', value: '#14532d' },
      { id: 'c9', name: 'Yellow', value: '#f59e0b' },
      { id: 'c10', name: 'Orange', value: '#f97316' },
    ];
    this.renderList();
    this.save();
  }

  private addColor() {
    const n = this.data.length + 1;
    const entry: ColorEntry = { id: 'c' + Date.now(), name: `Color ${n}`, value: '#888888' };
    this.data.push(entry);
    this.renderList();
    this.save();
  }

  private deleteColor(id: string) {
    this.data = this.data.filter(x => x.id !== id);
    this.renderList();
    this.save();
  }

  private updateColor(id: string, patch: Partial<ColorEntry>) {
    const e = this.data.find(x => x.id === id);
    if (!e) return;
    Object.assign(e, patch);
    this.save();
  }

  private renderList() {
    this.listEl.replaceChildren();
    for (const e of this.data) {
      const row = document.createElement('div');
      row.className = 'palette-row';

      const color = document.createElement('input');
      color.type = 'color';
      color.value = e.value;
      color.oninput = () => this.updateColor(e.id, { value: color.value });

      const name = document.createElement('input');
      name.type = 'text';
      name.value = e.name;
      name.placeholder = 'nazwa';
      name.oninput = () => this.updateColor(e.id, { name: name.value });

      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.onclick = () => this.deleteColor(e.id);

      row.append(color, name, del);
      this.listEl.appendChild(row);
    }
  }

  private renderSelect() {
    const prev = this.selectEl.value;
    this.selectEl.replaceChildren();
    for (const e of this.data) {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.name} (${e.value})`;
      opt.style.background = e.value;
      this.selectEl.appendChild(opt);
    }
    if (this.data.length) {
      const found = this.data.find(x => x.id === prev) || this.data[0];
      this.selectEl.value = found.id;
    }
  }
}

class Honeycomb {
  private placed: Set<string> = new Set();
  private frontier: Set<string> = new Set();
  private order: Axial[] = [];
  private colorByKey: Map<string, string> = new Map();

  radius = 20; // px, will be recomputed
  diameter = 40;
  areaDiamW = 90; // in diameters
  areaDiamH = 60; // in diameters
  areaW = 0; // px, computed
  areaH = 0; // px, computed

  private svg: SVGSVGElement;
  private gCircles: SVGGElement;
  private rect: SVGRectElement;
  private diameterLabel: HTMLElement;
  private countLabel: HTMLElement;

  private dirs: Axial[] = [
    { u: 0, v: 1 },
    { u: 1, v: 0 },
    { u: 1, v: -1 },
    { u: 0, v: -1 },
    { u: -1, v: 0 },
    { u: -1, v: 1 },
  ];

  constructor(host: HTMLElement) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.gCircles = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    this.svg.append(this.rect, this.gCircles);
    host.innerHTML = '';
    host.appendChild(this.svg);

    this.rect.setAttribute('class', 'area');

    this.diameterLabel = document.getElementById('diameterPx')!;
    this.countLabel = document.getElementById('count')!;

    this.reset();

    const ro = new ResizeObserver(() => this.resizeToHost(host));
    ro.observe(host);
    this.resizeToHost(host);
  }

  private key(a: Axial): string { return `${a.u},${a.v}`; }

  private axialToPoint(a: Axial): Point {
    const R = this.radius;
    const dx = Math.sqrt(3) * R;
    const up = { x: 0, y: 2 * R };
    const upr = { x: dx, y: R };
    return { x: a.u * upr.x + a.v * up.x, y: a.u * upr.y + a.v * up.y };
  }

  private ring(a: Axial): number {
    const x = a.u, y = a.v, z = -a.u - a.v;
    return Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
  }

  private ensureSeed() {
    if (!this.placed.size) {
      this.place({ u: 0, v: 0 });
    }
  }

  private place(a: Axial, color?: string) {
    const k = this.key(a);
    if (this.placed.has(k)) return;
    this.placed.add(k);
    this.order.push(a);
    if (color) this.colorByKey.set(k, color);

    for (const d of this.dirs) {
      const n = { u: a.u + d.u, v: a.v + d.v };
      const nk = this.key(n);
      if (!this.placed.has(nk)) this.frontier.add(nk);
    }
  }

  private nextCandidate(): Axial | undefined {
    let best: { a: Axial; ring: number; ord: number } | undefined;
    for (const k of this.frontier) {
      const [uStr, vStr] = k.split(',');
      const a = { u: parseInt(uStr, 10), v: parseInt(vStr, 10) };
      const r = this.ring(a);
      const ord = this.directionOrder(a);
      if (!best || r < best.ring || (r === best.ring && ord < best.ord)) {
        best = { a, ring: r, ord };
      }
    }
    return best?.a;
  }

  private randomCandidateInside(): Axial | undefined {
    const arr: Axial[] = [];
    for (const k of this.frontier) {
      const [uStr, vStr] = k.split(',');
      const a = { u: parseInt(uStr, 10), v: parseInt(vStr, 10) };
      const p = this.axialToPoint(a);
      if (this.withinArea(p)) arr.push(a);
    }
    if (!arr.length) return undefined;
    const idx = Math.floor(Math.random() * arr.length);
    return arr[idx];
  }

  private directionOrder(a: Axial): number {
    const p = this.axialToPoint(a);
    const ang = Math.atan2(p.y, p.x);
    const rot = ang - Math.PI / 2;
    let t = rot;
    while (t < 0) t += Math.PI * 2;
    const sector = Math.floor((t + Math.PI / 6) / (Math.PI / 3)) % 6;
    return sector;
  }

  resizeToHost(host: HTMLElement) {
    const w = host.clientWidth;
    const h = host.clientHeight;
    const d1 = Math.floor(w / this.areaDiamW);
    const d2 = Math.floor(h / this.areaDiamH);
    const d = Math.max(2, Math.min(d1, d2));
    this.diameter = d;
    this.radius = Math.max(1, Math.floor(this.diameter / 2));
    this.areaW = this.diameter * this.areaDiamW;
    this.areaH = this.diameter * this.areaDiamH;

    this.diameterLabel.textContent = String(this.diameter);

    this.svg.setAttribute('viewBox', `${-this.areaW / 2} ${-this.areaH / 2} ${this.areaW} ${this.areaH}`);

    this.rect.setAttribute('x', String(-this.areaW / 2));
    this.rect.setAttribute('y', String(-this.areaH / 2));
    this.rect.setAttribute('width', String(this.areaW));
    this.rect.setAttribute('height', String(this.areaH));

    this.renderAll();
  }

  private withinArea(p: Point): boolean {
    const R = this.radius;
    return (
      p.x >= -this.areaW / 2 + R &&
      p.x <= this.areaW / 2 - R &&
      p.y >= -this.areaH / 2 + R &&
      p.y <= this.areaH / 2 - R
    );
  }

  addOne(): boolean {
    this.ensureSeed();

    while (this.frontier.size) {
      const a = this.nextCandidate();
      if (!a) break;
      const k = this.key(a);
      this.frontier.delete(k);
      const p = this.axialToPoint(a);
      if (!this.withinArea(p)) {
        continue;
      }
      this.place(a);
      this.renderCircle(a, p);
      this.updateCount();
      return true;
    }
    return false;
  }

  addSix(): number {
    let c = 0;
    for (let i = 0; i < 6; i++) if (this.addOne()) c++;
    return c;
  }

  addRing(): number {
    const before = this.minFrontierRing();
    let c = 0;
    while (this.frontier.size) {
      const r = this.minFrontierRing();
      if (r !== before) break;
      if (this.addOne()) c++; else break;
    }
    return c;
  }

  addRandomWithColor(color: string): boolean {
    this.ensureSeed();
    const a = this.randomCandidateInside();
    if (!a) return false;
    const k = this.key(a);
    this.frontier.delete(k);
    const p = this.axialToPoint(a);
    this.place(a, color);
    this.renderCircle(a, p);
    this.updateCount();
    return true;
  }

  private minFrontierRing(): number {
    let best = Infinity;
    for (const k of this.frontier) {
      const [u, v] = k.split(',').map(Number);
      const r = this.ring({ u, v });
      if (r < best) best = r;
    }
    return best;
  }

  reset() {
    this.placed.clear();
    this.frontier.clear();
    this.order.length = 0;
    this.colorByKey.clear();
    this.gCircles.replaceChildren();
    this.place({ u: 0, v: 0 });
    const p0 = this.axialToPoint({ u: 0, v: 0 });
    this.renderCircle({ u: 0, v: 0 }, p0);
    this.updateCount();
  }

  private getSvgBackgroundRgb(): RGB {
    const cs = getComputedStyle(this.svg);
    const bg = cs.backgroundColor || '#10131a';
    return parseCssColorToRgb(bg) || { r: 16, g: 19, b: 26 };
  }

  private renderAll() {
    this.gCircles.replaceChildren();
    for (const a of this.order) {
      const p = this.axialToPoint(a);
      if (this.withinArea(p)) this.renderCircle(a, p);
    }
  }

  private renderCircle(a: Axial, p: Point) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('class', 'node');
    c.setAttribute('cx', String(p.x));
    c.setAttribute('cy', String(p.y));
    c.setAttribute('r', String(this.radius));
    c.setAttribute('data-key', this.key(a));

    const fill = this.colorByKey.get(this.key(a));
    if (fill) c.style.fill = fill;

    // Contrast-aware stroke if fill ~ background
    const bgRgb = this.getSvgBackgroundRgb();
    const fillRgb = parseCssColorToRgb(fill || getComputedStyle(c).fill || '#60a5fa')!;
    const ratio = contrastRatio(fillRgb, bgRgb);
    if (ratio < 2.0) {
      c.setAttribute('stroke', '#ffffff');
      c.setAttribute('stroke-width', String(Math.max(3, Math.round(this.radius * 0.3))));
      c.setAttribute('stroke-opacity', '0.95');
      c.setAttribute('shape-rendering', 'geometricPrecision');
    } else if (ratio < 3.0) {
      c.setAttribute('stroke', '#ffffff');
      c.setAttribute('stroke-width', String(Math.max(2, Math.round(this.radius * 0.18))));
      c.setAttribute('stroke-opacity', '0.9');
      c.setAttribute('shape-rendering', 'geometricPrecision');
    } else {
      c.removeAttribute('stroke');
      c.removeAttribute('stroke-width');
      c.removeAttribute('stroke-opacity');
    }

    this.gCircles.appendChild(c);
  }

  private updateCount() {
    this.countLabel.textContent = String(this.order.length);
  }
}

function main() {
  const host = document.getElementById('svgHost');
  if (!host) return;
  const model = new Honeycomb(host);

  const palette = new PaletteManager();

  (document.getElementById('btnAddOne') as HTMLButtonElement).onclick = () => model.addOne();
  (document.getElementById('btnAddSix') as HTMLButtonElement).onclick = () => model.addSix();
  (document.getElementById('btnAddRing') as HTMLButtonElement).onclick = () => model.addRing();
  (document.getElementById('btnReset') as HTMLButtonElement).onclick = () => model.reset();

  (document.getElementById('btnAddRandomColor').onclick = () => {\n    const sel = palette.selected;\n    if (!sel) return;\n    model.addRandomWithColor(sel.value);\n  };\n\n  (document.getElementById('btnAddRandomAny') as HTMLButtonElement).onclick = () => {\n    const all = palette.colors;\n    if (!all.length) return;\n    const pick = all[Math.floor(Math.random() * all.length)].value;\n    model.addRandomWithColor(pick);\n  };
}

document.addEventListener('DOMContentLoaded', main);


