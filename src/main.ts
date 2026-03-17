/* Clean TypeScript build for Honeycomb Circles Simulator */

type Axial = { u: number; v: number };
type Point = { x: number; y: number };
type RGB = { r: number; g: number; b: number };
type ColorEntry = { id: string; name: string; value: string };

const LS_PALETTE_KEY = 'honeycomb.palette.v1';

function parseCssColorToRgb(input: string): RGB | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  let m: RegExpExecArray | null;
  if ((m = /^#([0-9a-f]{3})$/.exec(s))) {
    const n = m[1];
    return { r: parseInt(n[0] + n[0], 16), g: parseInt(n[1] + n[1], 16), b: parseInt(n[2] + n[2], 16) };
  }
  if ((m = /^#([0-9a-f]{6})$/.exec(s))) {
    const n = m[1];
    return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16) };
  }
  if ((m = /^rgba?\(([^)]+)\)$/.exec(s))) {
    const parts = m[1].split(',').map((x) => x.trim());
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
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => v / 255);
  const lin = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(a: RGB, b: RGB): number {
  const L1 = relLuminance(a);
  const L2 = relLuminance(b);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

function isVeryDark(rgb: RGB): boolean { return relLuminance(rgb) < 0.04; }

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
    this.resetBtn.onclick = () => this.resetDefaults(true);

    this.load();
    this.renderList();
    this.renderSelect();
  }

  get selected(): ColorEntry | undefined { return this.data.find((x) => x.id === this.selectEl.value); }
  get colors(): ColorEntry[] { return this.data.slice(); }

  private load() {
    const raw = localStorage.getItem(LS_PALETTE_KEY);
    if (raw === null) { this.resetDefaults(true); return; }
    try {
      if (raw) {
        const parsed = JSON.parse(raw) as ColorEntry[];
        if (Array.isArray(parsed) && parsed.length) { this.data = parsed; return; }
      }
    } catch (e) { /* ignore */ }
    this.resetDefaults(false);
  }

  private save() { localStorage.setItem(LS_PALETTE_KEY, JSON.stringify(this.data)); this.renderSelect(); }

  private resetDefaults(persist = true) {
    this.data = [
      { id: 'c1', name: 'Czerwony', value: '#ff2d2d' },
      { id: 'c2', name: 'Sky', value: '#60a5fa' },
      { id: 'c3', name: 'Dark Blue', value: '#1e3a8a' },
      { id: 'c4', name: 'Black', value: '#000000' },
      { id: 'c5', name: 'White', value: '#ffffff' },
      { id: 'c6', name: 'Red', value: '#ef4444' },
      { id: 'c7', name: 'Brown', value: '#8b5a2b' },
      { id: 'c8', name: 'Grass Green', value: '#22c55e' },
      { id: 'c9', name: 'Dark Green', value: '#14532d' },
      { id: 'c10', name: 'Yellow', value: '#ffea00' },
      { id: 'c11', name: 'Orange', value: '#f97316' },
    ];
    this.renderList();
    if (persist) this.save(); else this.renderSelect();
  }

  private addColor() {
    const n = this.data.length + 1; const entry: ColorEntry = { id: 'c' + Date.now(), name: `Color ${n}`, value: '#888888' };
    this.data.push(entry); this.renderList(); this.save();
  }

  private deleteColor(id: string) { this.data = this.data.filter((x) => x.id !== id); this.renderList(); this.save(); }

  private updateColor(id: string, patch: Partial<ColorEntry>) {
    const e = this.data.find((x) => x.id === id); if (!e) return; Object.assign(e, patch); this.save();
  }

  private renderList() {
    this.listEl.replaceChildren();
    for (const e of this.data) {
      const row = document.createElement('div'); row.className = 'palette-row';
      const color = document.createElement('input'); color.type = 'color'; color.value = e.value; color.oninput = () => this.updateColor(e.id, { value: color.value });
      const name = document.createElement('input'); name.type = 'text'; name.value = e.name; name.placeholder = 'nazwa'; name.oninput = () => this.updateColor(e.id, { name: name.value });
      const del = document.createElement('button'); del.textContent = 'Delete'; del.onclick = () => this.deleteColor(e.id);
      row.append(color, name, del); this.listEl.appendChild(row);
    }
  }

  private renderSelect() {
    const prev = this.selectEl.value; this.selectEl.replaceChildren();
    for (const e of this.data) { const opt = document.createElement('option'); opt.value = e.id; opt.textContent = `${e.name} (${e.value})`; opt.style.background = e.value; this.selectEl.appendChild(opt); }
    if (this.data.length) { const found = this.data.find((x) => x.id === prev) || this.data[0]; this.selectEl.value = found.id; }
  }
}

class Honeycomb {
  private placed: Set<string> = new Set();
  private frontier: Set<string> = new Set();
  private order: Axial[] = [];
  private colorByKey: Map<string, string> = new Map();

  radius = 20; diameter = 40;
  areaDiamW = 90; areaDiamH = 60; areaW = 0; areaH = 0;

  private svg: SVGSVGElement; private gCircles: SVGGElement; private rect: SVGRectElement;
  private diameterLabel: HTMLElement; private countLabel: HTMLElement;

  private dirs: Axial[] = [ { u: 0, v: 1 }, { u: 1, v: 0 }, { u: 1, v: -1 }, { u: 0, v: -1 }, { u: -1, v: 0 }, { u: -1, v: 1 } ];

  constructor(host: HTMLElement) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.gCircles = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svg.append(this.rect, this.gCircles); host.innerHTML = ''; host.appendChild(this.svg);
    this.rect.setAttribute('class', 'area');
    this.diameterLabel = document.getElementById('diameterPx')!; this.countLabel = document.getElementById('count')!;
    this.reset(); const ro = new ResizeObserver(() => this.resizeToHost(host)); ro.observe(host); this.resizeToHost(host);
  }

  private key(a: Axial): string { return `${a.u},${a.v}`; }
  private axialToPoint(a: Axial): Point { const R = this.radius; const dx = Math.sqrt(3) * R; const up = { x: 0, y: 2 * R }; const upr = { x: dx, y: R }; return { x: a.u * upr.x + a.v * up.x, y: a.u * upr.y + a.v * up.y }; }

  private pointToAxialRound(p: Point): Axial {
    const R = this.radius; const dx = Math.sqrt(3) * R; const uf = p.x / dx; const vf = (p.y - R * uf) / (2 * R);
    let x = uf, y = vf, z = -uf - vf; let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const xd = Math.abs(rx - x), yd = Math.abs(ry - y), zd = Math.abs(rz - z);
    if (xd > yd && xd > zd) rx = -ry - rz; else if (yd > zd) ry = -rx - rz; else rz = -rx - ry;
    return { u: rx, v: ry };
  }

  private ring(a: Axial): number { const x = a.u, y = a.v, z = -a.u - a.v; return Math.max(Math.abs(x), Math.abs(y), Math.abs(z)); }
  private ensureSeed() { if (!this.placed.size) { this.place({ u: 0, v: 0 }); } }

  private place(a: Axial, color?: string) {
    const k = this.key(a); if (this.placed.has(k)) return; this.placed.add(k); this.order.push(a); if (color) this.colorByKey.set(k, color);
    for (const d of this.dirs) { const n = { u: a.u + d.u, v: a.v + d.v }; const nk = this.key(n); if (!this.placed.has(nk)) this.frontier.add(nk); }
  }

  private nextCandidate(): Axial | undefined {
    let best: { a: Axial; ring: number; ord: number } | undefined;
    for (const k of this.frontier) { const [us, vs] = k.split(','); const a = { u: parseInt(us, 10), v: parseInt(vs, 10) }; const r = this.ring(a); const ord = this.directionOrder(a); if (!best || r < best.ring || (r === best.ring && ord < best.ord)) best = { a, ring: r, ord }; }
    return best?.a;
  }

  private randomCandidateInside(): Axial | undefined { const arr: Axial[] = []; for (const k of this.frontier) { const [us, vs] = k.split(','); const a = { u: parseInt(us, 10), v: parseInt(vs, 10) }; const p = this.axialToPoint(a); if (this.withinArea(p)) arr.push(a); } if (!arr.length) return undefined; return arr[Math.floor(Math.random() * arr.length)]; }

  private angleOfPoint(p: Point): number { return Math.atan2(p.y, p.x); }
  private angleDiff(a: number, b: number): number { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); }

  private directionOrder(a: Axial): number { const p = this.axialToPoint(a); const ang = Math.atan2(p.y, p.x); const rot = ang - Math.PI / 2; let t = rot; while (t < 0) t += Math.PI * 2; return Math.floor((t + Math.PI / 6) / (Math.PI / 3)) % 6; }

  resizeToHost(host: HTMLElement) {
    const w = host.clientWidth, h = host.clientHeight; const d1 = Math.floor(w / this.areaDiamW), d2 = Math.floor(h / this.areaDiamH); const d = Math.max(2, Math.min(d1, d2));
    this.diameter = d; this.radius = Math.max(1, Math.floor(this.diameter / 2)); this.areaW = this.diameter * this.areaDiamW; this.areaH = this.diameter * this.areaDiamH;
    this.diameterLabel.textContent = String(this.diameter);
    this.svg.setAttribute('viewBox', `${-this.areaW / 2} ${-this.areaH / 2} ${this.areaW} ${this.areaH}`);
    this.rect.setAttribute('x', String(-this.areaW / 2)); this.rect.setAttribute('y', String(-this.areaH / 2)); this.rect.setAttribute('width', String(this.areaW)); this.rect.setAttribute('height', String(this.areaH));
    this.renderAll();
  }

  private withinArea(p: Point): boolean { const R = this.radius; return p.x >= -this.areaW / 2 + R && p.x <= this.areaW / 2 - R && p.y >= -this.areaH / 2 + R && p.y <= this.areaH / 2 - R; }

  addOne(): boolean {
    this.ensureSeed();
    while (this.frontier.size) { const a = this.nextCandidate(); if (!a) break; const k = this.key(a); this.frontier.delete(k); const p = this.axialToPoint(a); if (!this.withinArea(p)) continue; this.place(a); this.renderCircle(a, p); this.updateCount(); return true; }
    return false;
  }

  addSix(): number { let c = 0; for (let i = 0; i < 6; i++) if (this.addOne()) c++; return c; }
  addRing(): number { const before = this.minFrontierRing(); let c = 0; while (this.frontier.size) { const r = this.minFrontierRing(); if (r !== before) break; if (this.addOne()) c++; else break; } return c; }

  addRandomWithColor(color: string): boolean { this.ensureSeed(); const a = this.randomCandidateInside(); if (!a) return false; const k = this.key(a); this.frontier.delete(k); const p = this.axialToPoint(a); this.place(a, color); this.renderCircle(a, p); this.updateCount(); return true; }

  addClockWithColor(color: string): boolean {
    this.ensureSeed(); const hour = Math.floor(Math.random() * 12); const center = Math.PI / 2 + hour * (Math.PI / 6); const half = Math.PI / 12; const maxTries = 200;
    const existing: Axial[] = []; for (const a of this.order) { if (this.colorByKey.get(this.key(a)) === color) existing.push(a); }
    if (existing.length) {
      const inSector = existing.filter((a) => this.angleDiff(this.angleOfPoint(this.axialToPoint(a)), center) <= half);
      const pool = inSector.length ? inSector : existing; const base = pool[Math.floor(Math.random() * pool.length)];
      const candidates: Axial[] = []; for (const d of this.dirs) candidates.push({ u: base.u + d.u, v: base.v + d.v });
      candidates.sort((a, b) => this.angleDiff(this.angleOfPoint(this.axialToPoint(a)), center) - this.angleDiff(this.angleOfPoint(this.axialToPoint(b)), center));
      for (const n of candidates) { const k = this.key(n); const p = this.axialToPoint(n); if (!this.placed.has(k) && this.withinArea(p)) { this.place(n, color); this.renderCircle(n, p); this.updateCount(); return true; } }
    }
    for (let i = 0; i < maxTries; i++) {
      const x = Math.random() * (this.areaW - 2 * this.radius) + (-this.areaW / 2 + this.radius);
      const y = Math.random() * (this.areaH - 2 * this.radius) + (-this.areaH / 2 + this.radius);
      const p: Point = { x, y }; if (this.angleDiff(this.angleOfPoint(p), center) > half) continue; const a = this.pointToAxialRound(p); const k = this.key(a); const pc = this.axialToPoint(a);
      if (!this.placed.has(k) && this.withinArea(pc)) { this.place(a, color); this.renderCircle(a, pc); this.updateCount(); return true; }
    }
    return this.addRandomWithColor(color);
  }

  private minFrontierRing(): number { let best = Infinity; for (const k of this.frontier) { const [u, v] = k.split(',').map(Number); const r = this.ring({ u, v }); if (r < best) best = r; } return best; }

  reset() { this.placed.clear(); this.frontier.clear(); this.order.length = 0; this.colorByKey.clear(); this.gCircles.replaceChildren(); this.place({ u: 0, v: 0 }); const p0 = this.axialToPoint({ u: 0, v: 0 }); this.renderCircle({ u: 0, v: 0 }, p0); this.updateCount(); }

  private getSvgBackgroundRgb(): RGB { const cs = getComputedStyle(this.svg); const bg = (cs as any).backgroundColor || '#10131a'; return parseCssColorToRgb(String(bg)) || { r: 16, g: 19, b: 26 }; }

  private renderAll() { this.gCircles.replaceChildren(); for (const a of this.order) { const p = this.axialToPoint(a); if (this.withinArea(p)) this.renderCircle(a, p); } }

  private renderCircle(a: Axial, p: Point) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('class', 'node'); c.setAttribute('cx', String(p.x)); c.setAttribute('cy', String(p.y)); c.setAttribute('r', String(this.radius)); c.setAttribute('data-key', this.key(a));
    const fill = this.colorByKey.get(this.key(a)); if (fill) (c as any).style.fill = fill;
    const bgRgb = this.getSvgBackgroundRgb(); const fillRgb = parseCssColorToRgb(fill || getComputedStyle(c).fill || '#60a5fa')!; const ratio = contrastRatio(fillRgb, bgRgb);
    if (isVeryDark(fillRgb)) {
      const haloOuter = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); haloOuter.setAttribute('cx', String(p.x)); haloOuter.setAttribute('cy', String(p.y)); haloOuter.setAttribute('r', String(this.radius)); haloOuter.setAttribute('fill', 'none'); haloOuter.setAttribute('stroke', '#cbd5e1'); haloOuter.setAttribute('stroke-width', String(Math.max(4, Math.round(this.radius * 0.42)))); haloOuter.setAttribute('stroke-linejoin', 'round'); haloOuter.setAttribute('stroke-linecap', 'round');
      const haloInner = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); haloInner.setAttribute('cx', String(p.x)); haloInner.setAttribute('cy', String(p.y)); haloInner.setAttribute('r', String(this.radius)); haloInner.setAttribute('fill', 'none'); haloInner.setAttribute('stroke', '#ffffff'); haloInner.setAttribute('stroke-width', String(Math.max(3, Math.round(this.radius * 0.28)))); haloInner.setAttribute('stroke-linejoin', 'round'); haloInner.setAttribute('stroke-linecap', 'round');
      this.gCircles.appendChild(haloOuter); this.gCircles.appendChild(haloInner); this.gCircles.appendChild(c);
    } else if (ratio < 2.0) { c.setAttribute('stroke', '#ffffff'); c.setAttribute('stroke-width', String(Math.max(3, Math.round(this.radius * 0.3)))); c.setAttribute('stroke-opacity', '0.95'); c.setAttribute('shape-rendering', 'geometricPrecision'); this.gCircles.appendChild(c); }
    else if (ratio < 3.0) { c.setAttribute('stroke', '#ffffff'); c.setAttribute('stroke-width', String(Math.max(2, Math.round(this.radius * 0.18)))); c.setAttribute('stroke-opacity', '0.9'); c.setAttribute('shape-rendering', 'geometricPrecision'); this.gCircles.appendChild(c); }
    else { c.removeAttribute('stroke'); c.removeAttribute('stroke-width'); c.removeAttribute('stroke-opacity'); this.gCircles.appendChild(c); }
  }

  private updateCount() { this.countLabel.textContent = String(this.order.length); }
}

function main() {
  const host = document.getElementById('svgHost'); if (!host) return; const model = new Honeycomb(host as HTMLElement); const palette = new PaletteManager();
  (document.getElementById('btnAddOne') as HTMLButtonElement).onclick = () => model.addOne();
  (document.getElementById('btnAddSix') as HTMLButtonElement).onclick = () => model.addSix();
  (document.getElementById('btnAddRing') as HTMLButtonElement).onclick = () => model.addRing();
  (document.getElementById('btnReset') as HTMLButtonElement).onclick = () => model.reset();
  (document.getElementById('btnAddRandomColor') as HTMLButtonElement).onclick = () => { const sel = palette.selected; if (!sel) return; const strat = (document.getElementById('strategySelect') as HTMLSelectElement)?.value || 'frontier'; if (strat === 'clock') model.addClockWithColor(sel.value); else model.addRandomWithColor(sel.value); };
  (document.getElementById('btnAddRandomAny') as HTMLButtonElement).onclick = () => { const all = palette.colors; if (!all.length) return; const pick = all[Math.floor(Math.random() * all.length)].value; const strat = (document.getElementById('strategySelect') as HTMLSelectElement)?.value || 'frontier'; if (strat === 'clock') model.addClockWithColor(pick); else model.addRandomWithColor(pick); };
}

document.addEventListener('DOMContentLoaded', main);
