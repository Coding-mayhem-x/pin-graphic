"use strict";
// src/ca_rules.ts
// Cellular Automata rules based on neighbor colors (no modules; global namespace)
var CARules;
(function (CARules) {
    // Majority rule with threshold >=2 same-colored neighbors
    const majority2 = {
        key: 'majority2',
        description: 'Birth if at least 2 neighbors share a color; pick that color',
        birth: (ctx) => {
            let bestColor = null;
            let best = 0;
            for (const [color, n] of ctx.counts.entries()) {
                if (n > best) {
                    best = n;
                    bestColor = color;
                }
            }
            if (bestColor && best >= 2)
                return bestColor;
            return null;
        }
    };
    // Tie-break: prefer darker majority (fallback)
    const majority2PreferDark = {
        key: 'majority2_dark',
        description: 'Like majority2; on ties prefer darker color',
        birth: (ctx) => {
            let best = 0;
            const candidates = [];
            for (const [color, n] of ctx.counts.entries()) {
                if (n > best) {
                    best = n;
                    candidates.length = 0;
                    candidates.push(color);
                }
                else if (n === best) {
                    candidates.push(color);
                }
            }
            if (best >= 2 && candidates.length) {
                if (candidates.length === 1)
                    return candidates[0];
                const lum = (hex) => {
                    const p = (s) => parseInt(s, 16) / 255;
                    const h = hex.replace('#', '');
                    const r = p(h.slice(0, 2)), g = p(h.slice(2, 4)), b = p(h.slice(4, 6));
                    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
                };
                candidates.sort((a, b) => lum(a) - lum(b));
                return candidates[0];
            }
            return null;
        }
    };
    const registry = {
        [majority2.key]: majority2,
        [majority2PreferDark.key]: majority2PreferDark,
    };
    function getRule(key) { return registry[key] || majority2; }
    CARules.getRule = getRule;
    function list() { return Object.values(registry); }
    CARules.list = list;
})(CARules || (CARules = {}));
// src/ca_v2.ts
// CA v2: per-color birth + minimal-island focus + bridging
(function () {
    function getModel() { return window.honeyModel; }
    function key(a) { return a.u + "," + a.v; }
    function pickMinimalIsland(model, palette) {
        let bestColor = null;
        let bestComp = null;
        let bestSize = Infinity;
        const colors = palette.map(p => p.value);
        for (const color of colors) {
            const comps = model.componentsOfColor ? model.componentsOfColor(color) : [];
            for (const c of comps) {
                if (c.length > 0 && c.length < bestSize) {
                    bestSize = c.length;
                    bestComp = c;
                    bestColor = color;
                }
            }
        }
        if (bestComp && bestColor)
            return { color: bestColor, comp: bestComp };
        return null;
    }
    function frontierNeighbors(model, a) {
        const m = new Map();
        const neigh = model.neighbors(a);
        for (const n of neigh) {
            const nk = key(n);
            if (model.placed && model.placed.has(nk)) {
                const col = model.colorByKey.get(nk);
                if (col) {
                    m.set(col, (m.get(col) || 0) + 1);
                }
            }
        }
        return m;
    }
    function findBestCAV2(model, palette, selectedId) {
        var _a;
        const selected = selectedId ? ((_a = palette.find(p => p.id === selectedId)) === null || _a === void 0 ? void 0 : _a.value) : undefined;
        // 1) If minimal island exists, try to grow it first
        const min = pickMinimalIsland(model, palette);
        if (min) {
            const frees = model.freeNeighbors(min.comp);
            let best = null;
            for (const f of frees) {
                const by = frontierNeighbors(model, f);
                const ctx = { total: Array.from(by.values()).reduce((s, n) => s + n, 0), counts: by };
                let pick = null;
                if (selected && (ctx.total >= 2))
                    pick = selected;
                else if (selected && (by.get(selected) || 0) >= 1 && (min && min.color === selected))
                    pick = selected;
                if (!pick && window.CARules && window.CARules.getRule) {
                    pick = CARules.getRule('majority2').birth(ctx);
                }
                if (pick) {
                    const pt = model.axialToPoint(f);
                    if (model.withinArea(pt)) {
                        best = { a: f, color: pick };
                        break;
                    }
                }
            }
            if (best)
                return best;
        }
        // 2) Otherwise scan global frontier and use majority2 or bridging by selected
        let best = null;
        for (const k of model.frontier) {
            const [u, v] = k.split(',').map((t) => parseInt(t, 10));
            const a = { u, v };
            const by = frontierNeighbors(model, a);
            const total = Array.from(by.values()).reduce((s, n) => s + n, 0);
            if (total === 0)
                continue;
            let pick = null;
            if (selected && total >= 2)
                pick = selected;
            if (!pick && window.CARules && window.CARules.getRule) {
                pick = CARules.getRule('majority2').birth({ total, counts: by });
            }
            if (!pick)
                continue;
            const pt = model.axialToPoint(a);
            if (!model.withinArea(pt))
                continue; // simple score: prefer fewer neighbors to help gaps
            const nSame = by.get(pick) || 0;
            const score = (min ? 1 : 0) * 1000 + nSame * 10 - total;
            if (!best || score > best.score)
                best = { a, color: pick, score };
        }
        return best ? { a: best.a, color: best.color } : null;
    }
    function placeCAV2() {
        var _a;
        const model = getModel();
        if (!model)
            return false;
        const pal = window.paletteManager;
        const palette = pal.colors;
        const selectedId = (_a = pal.selected) === null || _a === void 0 ? void 0 : _a.id;
        const pick = findBestCAV2(model, palette, selectedId);
        if (!pick)
            return false;
        const k = key(pick.a);
        model.frontier.delete(k);
        const p = model.axialToPoint(pick.a);
        if (!model.withinArea(p))
            return false;
        model.place(pick.a, pick.color);
        model.renderCircle(pick.a, p);
        model.updateCount();
        return true;
    }
    function interceptRunner() {
        const sel = document.getElementById('strategySelect');
        if (!sel)
            return;
        if (!Array.from(sel.options).some(o => o.value === 'ca-v2')) {
            const opt = document.createElement('option');
            opt.value = 'ca-v2';
            opt.textContent = 'CA v2';
            sel.appendChild(opt);
        }
        const btnAny = document.getElementById('btnAddRandomAny');
        if (btnAny) {
            btnAny.addEventListener('click', function (ev) { const cur = (sel.value || ''); if (cur === 'ca-v2') {
                ev.stopImmediatePropagation();
                ev.preventDefault();
                placeCAV2();
            } }, true);
        }
        const btnSel = document.getElementById('btnAddRandomColor');
        if (btnSel) {
            btnSel.addEventListener('click', function (ev) { const cur = (sel.value || ''); if (cur === 'ca-v2') {
                ev.stopImmediatePropagation();
                ev.preventDefault();
                placeCAV2();
            } }, true);
        }
    }
    document.addEventListener('DOMContentLoaded', interceptRunner);
})();
/// <reference path="./ca_rules.ts" />
/* Clean TypeScript build for Honeycomb Circles Simulator */
const LS_PALETTE_KEY = 'honeycomb.palette.v1';
function parseCssColorToRgb(input) {
    if (!input)
        return null;
    const s = input.trim().toLowerCase();
    let m;
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
function relLuminance(rgb) {
    const srgb = [rgb.r, rgb.g, rgb.b].map((v) => v / 255);
    const lin = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrastRatio(a, b) {
    const L1 = relLuminance(a);
    const L2 = relLuminance(b);
    const light = Math.max(L1, L2);
    const dark = Math.min(L1, L2);
    return (light + 0.05) / (dark + 0.05);
}
function isVeryDark(rgb) { return relLuminance(rgb) < 0.04; }
class PaletteManager {
    constructor() {
        this.data = [];
        this.listEl = document.getElementById('paletteList');
        this.selectEl = document.getElementById('paletteSelect');
        this.addBtn = document.getElementById('btnPaletteAdd');
        this.resetBtn = document.getElementById('btnPaletteReset');
        this.addBtn.onclick = () => this.addColor();
        this.resetBtn.onclick = () => this.resetDefaults(true);
        this.load();
        this.renderList();
        this.renderSelect();
    }
    get selected() { return this.data.find((x) => x.id === this.selectEl.value); }
    get colors() { return this.data.slice(); }
    load() {
        const raw = localStorage.getItem(LS_PALETTE_KEY);
        if (raw === null) {
            this.resetDefaults(true);
            return;
        }
        try {
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length) {
                    this.data = parsed;
                    return;
                }
            }
        }
        catch { /* ignore */ }
        this.resetDefaults(false);
    }
    save() { localStorage.setItem(LS_PALETTE_KEY, JSON.stringify(this.data)); this.renderSelect(); }
    resetDefaults(persist = true) {
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
        if (persist)
            this.save();
        else
            this.renderSelect();
    }
    addColor() { const n = this.data.length + 1; const entry = { id: 'c' + Date.now(), name: `Color ${n}`, value: '#888888' }; this.data.push(entry); this.renderList(); this.save(); }
    deleteColor(id) { this.data = this.data.filter((x) => x.id !== id); this.renderList(); this.save(); }
    updateColor(id, patch) { const e = this.data.find((x) => x.id === id); if (!e)
        return; Object.assign(e, patch); this.save(); }
    renderList() {
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
    renderSelect() {
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
            const found = this.data.find((x) => x.id === prev) || this.data[0];
            this.selectEl.value = found.id;
        }
    }
}
class Honeycomb {
    constructor(host) {
        this.hoverAxial = null;
        this.getColor = null;
        this.placed = new Set();
        this.frontier = new Set();
        this.order = [];
        this.colorByKey = new Map();
        this.sizeFactorByKey = new Map();
        this.radius = 20;
        this.diameter = 40;
        this.areaDiamW = 90;
        this.areaDiamH = 60;
        this.areaW = 0;
        this.areaH = 0;
        this.dirs = [{ u: 0, v: 1 }, { u: 1, v: 0 }, { u: 1, v: -1 }, { u: 0, v: -1 }, { u: -1, v: 0 }, { u: -1, v: 1 }];
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.gCircles = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.svg.append(this.rect, this.gCircles);
        host.innerHTML = '';
        host.appendChild(this.svg);
        this.preview = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.preview.setAttribute('class', 'preview');
        this.preview.setAttribute('r', String(this.radius));
        this.preview.setAttribute('cx', '0');
        this.preview.setAttribute('cy', '0');
        this.preview.style.pointerEvents = 'none';
        this.svg.appendChild(this.preview);
        this.diameterLabel = document.getElementById('diameterPx');
        this.countLabel = document.getElementById('count');
        this.reset();
        const ro = new ResizeObserver(() => this.resizeToHost(host));
        ro.observe(host);
        this.resizeToHost(host);
    }
    key(a) { return `${a.u},${a.v}`; }
    axialToPoint(a) { const R = this.radius; const dx = Math.sqrt(3) * R; const up = { x: 0, y: 2 * R }; const upr = { x: dx, y: R }; return { x: a.u * upr.x + a.v * up.x, y: a.u * upr.y + a.v * up.y }; }
    pointToAxialRound(p) { const R = this.radius; const dx = Math.sqrt(3) * R; const uf = p.x / dx; const vf = (p.y - R * uf) / (2 * R); let x = uf, y = vf, z = -uf - vf; let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z); const xd = Math.abs(rx - x), yd = Math.abs(ry - y), zd = Math.abs(rz - z); if (xd > yd && xd > zd)
        rx = -ry - rz;
    else if (yd > zd)
        ry = -rx - rz;
    else
        rz = -rx - ry; return { u: rx, v: ry }; }
    ring(a) { const x = a.u, y = a.v, z = -a.u - a.v; return Math.max(Math.abs(x), Math.abs(y), Math.abs(z)); }
    ensureSeed() { if (!this.placed.size) {
        this.place({ u: 0, v: 0 });
    } }
    place(a, color) { const k = this.key(a); if (this.placed.has(k))
        return; this.placed.add(k); this.order.push(a); if (color)
        this.colorByKey.set(k, color); for (const d of this.dirs) {
        const n = { u: a.u + d.u, v: a.v + d.v };
        const nk = this.key(n);
        if (!this.placed.has(nk))
            this.frontier.add(nk);
    } }
    nextCandidate() { let best; for (const k of this.frontier) {
        const [us, vs] = k.split(',');
        const a = { u: parseInt(us, 10), v: parseInt(vs, 10) };
        const r = this.ring(a);
        const ord = this.directionOrder(a);
        if (!best || r < best.ring || (r === best.ring && ord < best.ord))
            best = { a, ring: r, ord };
    } return best === null || best === void 0 ? void 0 : best.a; }
    randomCandidateInside() { const arr = []; for (const k of this.frontier) {
        const [us, vs] = k.split(',');
        const a = { u: parseInt(us, 10), v: parseInt(vs, 10) };
        const p = this.axialToPoint(a);
        if (this.withinArea(p))
            arr.push(a);
    } if (!arr.length)
        return undefined; return arr[Math.floor(Math.random() * arr.length)]; }
    angleOfPoint(p) { return Math.atan2(p.y, p.x); }
    angleDiff(a, b) { let d = a - b; while (d > Math.PI)
        d -= 2 * Math.PI; while (d < -Math.PI)
        d += 2 * Math.PI; return Math.abs(d); }
    directionOrder(a) { const p = this.axialToPoint(a); const ang = Math.atan2(p.y, p.x); const rot = ang - Math.PI / 2; let t = rot; while (t < 0)
        t += Math.PI * 2; return Math.floor((t + Math.PI / 6) / (Math.PI / 3)) % 6; }
    addAx(a, b, k = 1) { return { u: a.u + b.u * k, v: a.v + b.v * k }; }
    neighbors(a) { return this.dirs.map(d => ({ u: a.u + d.u, v: a.v + d.v })); }
    nodesOfColor(color) { const res = []; for (const a of this.order) {
        if (this.colorByKey.get(this.key(a)) === color)
            res.push(a);
    } return res; }
    componentsOfColor(color) { const nodes = this.nodesOfColor(color); const set = new Set(nodes.map(a => this.key(a))); const seen = new Set(); const comps = []; for (const a of nodes) {
        const k = this.key(a);
        if (seen.has(k))
            continue;
        const comp = [];
        const stack = [a];
        seen.add(k);
        while (stack.length) {
            const cur = stack.pop();
            comp.push(cur);
            for (const nb of this.neighbors(cur)) {
                const nk = this.key(nb);
                if (set.has(nk) && !seen.has(nk)) {
                    seen.add(nk);
                    stack.push(nb);
                }
            }
        }
        comps.push(comp);
    } return comps; }
    centroidOfGroup(group) { let sx = 0, sy = 0; for (const a of group) {
        const p = this.axialToPoint(a);
        sx += p.x;
        sy += p.y;
    } const n = group.length || 1; return { x: sx / n, y: sy / n }; }
    freeNeighbors(group) { const uniq = new Set(); const out = []; for (const a of group) {
        for (const nb of this.neighbors(a)) {
            const k = this.key(nb);
            if (uniq.has(k))
                continue;
            uniq.add(k);
            const p = this.axialToPoint(nb);
            if (!this.placed.has(k) && this.withinArea(p))
                out.push(nb);
        }
    } return out; }
    findNearestFree(target, maxRing = 60, biasAngle) {
        const isFree = (a) => { const k = this.key(a); const p = this.axialToPoint(a); return !this.placed.has(k) && this.withinArea(p); };
        if (isFree(target))
            return target;
        let startSide = 0;
        if (typeof biasAngle === 'number') {
            let best = Infinity;
            let idx = 0;
            for (let i = 0; i < 6; i++) {
                const nb = { u: target.u + this.dirs[i].u, v: target.v + this.dirs[i].v };
                const ang = this.angleOfPoint(this.axialToPoint(nb));
                const diff = this.angleDiff(ang, biasAngle);
                if (diff < best) {
                    best = diff;
                    idx = i;
                }
            }
            startSide = (idx + 5) % 6;
        }
        for (let r = 1; r <= maxRing; r++) {
            let q = this.addAx(target, this.dirs[startSide], r);
            for (let s = 0; s < 6; s++) {
                const side = (startSide + s) % 6;
                for (let step = 0; step < r; step++) {
                    if (isFree(q))
                        return q;
                    q = this.addAx(q, this.dirs[(side + 1) % 6], 1);
                }
            }
        }
        return undefined;
    }
    setColorProvider(fn) { this.getColor = fn; }
    enableManual() {
        const onMove = (ev) => this.handlePointer(ev);
        const onClick = (ev) => this.handleClick(ev);
        const onLeave = (_) => { this.hoverAxial = null; this.preview.setAttribute('visibility', 'hidden'); };
        this.svg.addEventListener('mousemove', onMove);
        this.svg.addEventListener('mouseleave', onLeave);
        this.svg.addEventListener('click', onClick);
    }
    handlePointer(ev) {
        const rect = this.svg.getBoundingClientRect();
        const x = (ev.clientX - rect.left) / rect.width * this.areaW - this.areaW / 2;
        const y = (ev.clientY - rect.top) / rect.height * this.areaH - this.areaH / 2;
        const cand = this.candidateForPoint({ x, y });
        if (!cand) {
            this.hoverAxial = null;
            this.preview.setAttribute('visibility', 'hidden');
            return;
        }
        this.hoverAxial = cand;
        const p = this.axialToPoint(cand);
        this.preview.setAttribute('cx', String(p.x));
        this.preview.setAttribute('cy', String(p.y));
        this.preview.setAttribute('r', String(this.radius));
        const col = this.getColor ? this.getColor() : undefined;
        if (col) {
            this.preview.style.fill = col;
            this.preview.style.fillOpacity = '0.35';
        }
        else {
            this.preview.style.fill = 'transparent';
            this.preview.style.fillOpacity = '0';
        }
        this.preview.setAttribute('visibility', 'visible');
    }
    handleClick(_ev) {
        if (!this.hoverAxial)
            return;
        const k = this.key(this.hoverAxial);
        const p = this.axialToPoint(this.hoverAxial);
        if (this.placed.has(k) || !this.withinArea(p))
            return;
        const col = this.getColor ? this.getColor() : undefined;
        this.place(this.hoverAxial, col);
        this.renderCircle(this.hoverAxial, p);
        this.updateCount();
    }
    candidateForPoint(p) {
        const a = this.pointToAxialRound(p);
        const b = this.findNearestFree(a, 40);
        return b || undefined;
    }
    resizeToHost(host) {
        const w = host.clientWidth, h = host.clientHeight;
        const d1 = Math.floor(w / this.areaDiamW), d2 = Math.floor(h / this.areaDiamH);
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
    withinArea(p) { const R = this.radius; return p.x >= -this.areaW / 2 + R && p.x <= this.areaW / 2 - R && p.y >= -this.areaH / 2 + R && p.y <= this.areaH / 2 - R; }
    addOne() { this.ensureSeed(); while (this.frontier.size) {
        const a = this.nextCandidate();
        if (!a)
            break;
        const k = this.key(a);
        this.frontier.delete(k);
        const p = this.axialToPoint(a);
        if (!this.withinArea(p))
            continue;
        this.place(a);
        this.renderCircle(a, p);
        this.updateCount();
        return true;
    } return false; }
    addSix() { let c = 0; for (let i = 0; i < 6; i++)
        if (this.addOne())
            c++; return c; }
    addRing() { const before = this.minFrontierRing(); let c = 0; while (this.frontier.size) {
        const r = this.minFrontierRing();
        if (r !== before)
            break;
        if (this.addOne())
            c++;
        else
            break;
    } return c; }
    addRandomWithColor(color) { this.ensureSeed(); const a = this.randomCandidateInside(); if (!a)
        return false; const k = this.key(a); this.frontier.delete(k); const p = this.axialToPoint(a); this.place(a, color); this.renderCircle(a, p); this.updateCount(); return true; }
    placeAsNewInWedge(color, center, attempts = 200) {
        for (let i = 0; i < attempts; i++) {
            const x = Math.random() * (this.areaW - 2 * this.radius) + (-this.areaW / 2 + this.radius);
            const y = Math.random() * (this.areaH - 2 * this.radius) + (-this.areaH / 2 + this.radius);
            const p = { x, y };
            if (this.angleDiff(this.angleOfPoint(p), center) > Math.PI / 12)
                continue;
            const a = this.pointToAxialRound(p);
            const b = this.findNearestFree(a, 40, center);
            if (b) {
                const pb = this.axialToPoint(b);
                this.place(b, color);
                this.renderCircle(b, pb);
                this.updateCount();
                return true;
            }
        }
        return false;
    }
    addClockWithColor(color) {
        this.ensureSeed();
        const hour = Math.floor(Math.random() * 12);
        const center = Math.PI / 2 + hour * (Math.PI / 6);
        const maxTries = 200;
        const existing = this.nodesOfColor(color);
        if (!existing.length) {
            return this.placeAsNewInWedge(color, center) || false;
        }
        const comps = this.componentsOfColor(color);
        const comp = comps[Math.floor(Math.random() * comps.length)];
        // try touching neighbor biased by center
        const candidates = [];
        for (const base of comp) {
            let bestDir = 0, best = Infinity;
            for (let i = 0; i < 6; i++) {
                const nb = { u: base.u + this.dirs[i].u, v: base.v + this.dirs[i].v };
                const ang = this.angleOfPoint(this.axialToPoint(nb));
                const d = this.angleDiff(ang, center);
                if (d < best) {
                    best = d;
                    bestDir = i;
                }
            }
            candidates.push({ u: base.u + this.dirs[bestDir].u, v: base.v + this.dirs[bestDir].v });
        }
        for (const n of candidates) {
            const k = this.key(n);
            const p = this.axialToPoint(n);
            if (!this.placed.has(k) && this.withinArea(p)) {
                this.place(n, color);
                this.renderCircle(n, p);
                this.updateCount();
                return true;
            }
        }
        // random in wedge
        for (let i = 0; i < maxTries; i++) {
            const x = Math.random() * (this.areaW - 2 * this.radius) + (-this.areaW / 2 + this.radius);
            const y = Math.random() * (this.areaH - 2 * this.radius) + (-this.areaH / 2 + this.radius);
            const p = { x, y };
            if (this.angleDiff(this.angleOfPoint(p), center) > Math.PI / 12)
                continue;
            const a = this.pointToAxialRound(p);
            const b = this.findNearestFree(a, 40, center);
            if (b) {
                const pb = this.axialToPoint(b);
                this.place(b, color);
                this.renderCircle(b, pb);
                this.updateCount();
                return true;
            }
        }
        return false;
    }
    addClockV2WithColor(color) {
        this.ensureSeed();
        const comps = this.componentsOfColor(color);
        if (comps.length === 0) {
            const hour = Math.floor(Math.random() * 12);
            const center = Math.PI / 2 + hour * (Math.PI / 6);
            return this.placeAsNewInWedge(color, center);
        }
        const comp = comps[Math.floor(Math.random() * comps.length)];
        const centroid = this.centroidOfGroup(comp);
        const hour2 = Math.floor(Math.random() * 12);
        const center2 = Math.PI / 2 + hour2 * (Math.PI / 6);
        const half = Math.PI / 12;
        const inWedge = [];
        for (const a of comp) {
            const p = this.axialToPoint(a);
            const rel = { x: p.x - centroid.x, y: p.y - centroid.y };
            if (this.angleDiff(this.angleOfPoint(rel), center2) <= half)
                inWedge.push(a);
        }
        let base;
        if (inWedge.length)
            base = inWedge[Math.floor(Math.random() * inWedge.length)];
        else {
            let bestA = comp[0];
            let best = Infinity;
            for (const a of comp) {
                const p = this.axialToPoint(a);
                const rel = { x: p.x - centroid.x, y: p.y - centroid.y };
                const d = this.angleDiff(this.angleOfPoint(rel), center2);
                if (d < best) {
                    best = d;
                    bestA = a;
                }
            }
            base = bestA;
        }
        let bestDir = 0;
        let bestD = Infinity;
        for (let i = 0; i < 6; i++) {
            const nb = { u: base.u + this.dirs[i].u, v: base.v + this.dirs[i].v };
            const ang = this.angleOfPoint(this.axialToPoint(nb));
            const d = this.angleDiff(ang, center2);
            if (d < bestD) {
                bestD = d;
                bestDir = i;
            }
        }
        const nb = { u: base.u + this.dirs[bestDir].u, v: base.v + this.dirs[bestDir].v };
        const nbKey = this.key(nb);
        const nbPt = this.axialToPoint(nb);
        if (!this.placed.has(nbKey) && this.withinArea(nbPt)) {
            this.place(nb, color);
            this.renderCircle(nb, nbPt);
            this.updateCount();
            return true;
        }
        // nearest free neighbor toward centroid
        let bestPick;
        for (const n of this.freeNeighbors(comp)) {
            const p = this.axialToPoint(n);
            const dx = p.x - centroid.x, dy = p.y - centroid.y;
            const d = dx * dx + dy * dy;
            if (!bestPick || d < bestPick.dist)
                bestPick = { a: n, dist: d };
        }
        if (bestPick) {
            const pb = this.axialToPoint(bestPick.a);
            this.place(bestPick.a, color);
            this.renderCircle(bestPick.a, pb);
            this.updateCount();
            return true;
        }
        // fallback new in wedge
        return this.placeAsNewInWedge(color, center2);
    }
    addAnywhereWithColor(color) {
        this.ensureSeed();
        const attempts = 300;
        for (let i = 0; i < attempts; i++) {
            const x = Math.random() * (this.areaW - 2 * this.radius) + (-this.areaW / 2 + this.radius);
            const y = Math.random() * (this.areaH - 2 * this.radius) + (-this.areaH / 2 + this.radius);
            const a = this.pointToAxialRound({ x, y });
            const b = this.findNearestFree(a, 60);
            if (b) {
                const p = this.axialToPoint(b);
                if (this.withinArea(p)) {
                    this.place(b, color);
                    this.renderCircle(b, p);
                    this.updateCount();
                    return true;
                }
            }
        }
        return false;
    }
    addClockV3WithColor(color) {
        this.ensureSeed();
        const comps = this.componentsOfColor(color);
        if (comps.length === 0) {
            const hour0 = Math.floor(Math.random() * 12);
            const center0 = Math.PI / 2 + hour0 * (Math.PI / 6);
            return this.placeAsNewInWedge(color, center0);
        }
        const freesPerComp = [];
        const union = new Map();
        for (const comp of comps) {
            const centroid = this.centroidOfGroup(comp);
            const frees = this.freeNeighbors(comp);
            const uniq = [];
            const seen = new Set();
            for (const f of frees) {
                const k = this.key(f);
                if (seen.has(k))
                    continue;
                seen.add(k);
                uniq.push(f);
                if (!union.has(k))
                    union.set(k, f);
            }
            freesPerComp.push({ comp, frees: uniq, centroid });
        }
        if (union.size === 1) {
            const only = Array.from(union.values())[0];
            const p = this.axialToPoint(only);
            this.place(only, color);
            this.renderCircle(only, p);
            this.updateCount();
            return true;
        }
        const candidates = freesPerComp.filter(e => e.frees.length > 0);
        const hour = Math.floor(Math.random() * 12);
        const center = Math.PI / 2 + hour * (Math.PI / 6);
        if (candidates.length) {
            let minCount = Math.min.apply(null, candidates.map(e => e.frees.length));
            const scarce = candidates.filter(e => e.frees.length === minCount);
            let pick = scarce[0];
            let best = Infinity;
            for (const e of scarce) {
                const ang = this.angleOfPoint(e.centroid);
                const d = this.angleDiff(ang, center);
                if (d < best) {
                    best = d;
                    pick = e;
                }
            }
            let bestNode = null;
            let bestScore = Infinity;
            for (const n of pick.frees) {
                const pt = this.axialToPoint(n);
                const dAng = this.angleDiff(this.angleOfPoint(pt), center);
                const dx = pt.x - pick.centroid.x, dy = pt.y - pick.centroid.y;
                const d2 = dx * dx + dy * dy;
                const score = dAng * 10 + d2 / (this.radius * this.radius + 1);
                if (score < bestScore) {
                    bestScore = score;
                    bestNode = n;
                }
            }
            if (bestNode) {
                const pb = this.axialToPoint(bestNode);
                this.place(bestNode, color);
                this.renderCircle(bestNode, pb);
                this.updateCount();
                return true;
            }
        }
        return this.placeAsNewInWedge(color, center);
    }
    minFrontierRing() { let best = Infinity; for (const k of this.frontier) {
        const [u, v] = k.split(',').map(Number);
        const r = this.ring({ u, v });
        if (r < best)
            best = r;
    } return best; }
    // Cellular Automata (color-based) one step using external rules
    addCAColorStep(ruleKey = "majority2") {
        this.ensureSeed();
        let best = null;
        for (const k of this.frontier) {
            const parts = k.split(',');
            const a = { u: parseInt(parts[0], 10), v: parseInt(parts[1], 10) };
            const neigh = this.neighbors(a);
            const counts = new Map();
            let total = 0;
            for (const n of neigh) {
                const nk = this.key(n);
                if (this.placed.has(nk)) {
                    const col = this.colorByKey.get(nk);
                    if (!col)
                        continue; // only consider colored neighbors
                    total++;
                    counts.set(col, (counts.get(col) || 0) + 1);
                }
            }
            if (total === 0 || counts.size === 0)
                continue;
            const rule = (CARules && CARules.getRule) ? CARules.getRule(ruleKey) : null;
            const birthColor = rule ? rule.birth({ total, counts }) : null;
            if (!birthColor)
                continue;
            // score: prefer more neighbors and stronger majority
            let maxSame = 0;
            for (const v of counts.values()) {
                if (v > maxSame)
                    maxSame = v;
            }
            const score = total * 10 + maxSame;
            if (!best || score > best.score) {
                best = { a, score, color: birthColor };
            }
        }
        if (best) {
            const b = best.a;
            const k = this.key(b);
            this.frontier.delete(k);
            const p = this.axialToPoint(b);
            if (!this.withinArea(p))
                return false;
            this.place(b, best.color);
            this.renderCircle(b, p);
            this.updateCount();
            return true;
        }
        return false;
    }
    reset() { this.placed.clear(); this.frontier.clear(); this.order.length = 0; this.colorByKey.clear(); this.gCircles.replaceChildren(); this.sizeFactorByKey.clear(); this.place({ u: 0, v: 0 }); const p0 = this.axialToPoint({ u: 0, v: 0 }); this.renderCircle({ u: 0, v: 0 }, p0); this.updateCount(); }
    getSvgBackgroundRgb() { const cs = getComputedStyle(this.svg); const bg = cs.backgroundColor || '#10131a'; return parseCssColorToRgb(String(bg)) || { r: 16, g: 19, b: 26 }; }
    renderAll() { this.gCircles.replaceChildren(); for (const a of this.order) {
        const p = this.axialToPoint(a);
        if (this.withinArea(p))
            this.renderCircle(a, p);
    } }
    renderCircle(a, p) {
        var _a;
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('class', 'node');
        c.setAttribute('cx', String(p.x));
        c.setAttribute('cy', String(p.y));
        {
            const rk = this.key(a);
            const rf = (_a = this.sizeFactorByKey.get(rk)) !== null && _a !== void 0 ? _a : 1;
            c.setAttribute('r', String(Math.max(1, Math.round(this.radius * rf))));
        }
        ;
        c.setAttribute('data-key', this.key(a));
        const fill = this.colorByKey.get(this.key(a));
        if (fill)
            c.style.fill = fill;
        const bgRgb = this.getSvgBackgroundRgb();
        const fillRgb = parseCssColorToRgb(fill || getComputedStyle(c).fill || '#60a5fa');
        const ratio = contrastRatio(fillRgb, bgRgb);
        if (isVeryDark(fillRgb)) {
            const haloOuter = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            haloOuter.setAttribute('cx', String(p.x));
            haloOuter.setAttribute('cy', String(p.y));
            haloOuter.setAttribute('r', String(this.radius));
            haloOuter.setAttribute('fill', 'none');
            haloOuter.setAttribute('stroke', '#cbd5e1');
            haloOuter.setAttribute('stroke-width', String(Math.max(4, Math.round(this.radius * 0.42))));
            haloOuter.setAttribute('stroke-linejoin', 'round');
            haloOuter.setAttribute('stroke-linecap', 'round');
            const haloInner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            haloInner.setAttribute('cx', String(p.x));
            haloInner.setAttribute('cy', String(p.y));
            haloInner.setAttribute('r', String(this.radius));
            haloInner.setAttribute('fill', 'none');
            haloInner.setAttribute('stroke', '#ffffff');
            haloInner.setAttribute('stroke-width', String(Math.max(3, Math.round(this.radius * 0.28))));
            haloInner.setAttribute('stroke-linejoin', 'round');
            haloInner.setAttribute('stroke-linecap', 'round');
            this.gCircles.appendChild(haloOuter);
            this.gCircles.appendChild(haloInner);
            this.gCircles.appendChild(c);
        }
        else if (ratio < 2.0) {
            c.setAttribute('stroke', '#ffffff');
            c.setAttribute('stroke-width', String(Math.max(3, Math.round(this.radius * 0.3))));
            c.setAttribute('stroke-opacity', '0.95');
            c.setAttribute('shape-rendering', 'geometricPrecision');
            this.gCircles.appendChild(c);
        }
        else if (ratio < 3.0) {
            c.setAttribute('stroke', '#ffffff');
            c.setAttribute('stroke-width', String(Math.max(2, Math.round(this.radius * 0.18))));
            c.setAttribute('stroke-opacity', '0.9');
            c.setAttribute('shape-rendering', 'geometricPrecision');
            this.gCircles.appendChild(c);
        }
        else {
            c.removeAttribute('stroke');
            c.removeAttribute('stroke-width');
            c.removeAttribute('stroke-opacity');
            this.gCircles.appendChild(c);
        }
    }
    applyHalftoneFromSampler(s, fit) {
        this.sizeFactorByKey.clear();
        for (const a of this.order) {
            const p = this.axialToPoint(a);
            const rgb = s.sampleAt(p, this.areaW, this.areaH, fit) || { r: 16, g: 19, b: 26 };
            const L = relLuminance(rgb);
            const f = Math.max(0.35, Math.min(1.0, 1.0 - L));
            this.sizeFactorByKey.set(this.key(a), f);
        }
        this.renderAll();
    }
    clearHalftone() { this.sizeFactorByKey.clear(); this.renderAll(); }
    applyDitherMixFromSampler(s, fit, palette) {
        if (!s || !s.isReady || !s.isReady()) {
            return;
        }
        for (const a of this.order) {
            const p = this.axialToPoint(a);
            const rgb = s.sampleAt(p, this.areaW, this.areaH, fit) || { r: 16, g: 19, b: 26 };
            const pair = nearestTwoFromPalette(rgb, palette);
            const r = pair.db / Math.max(1e-6, (pair.da + pair.db));
            const thr = bayer8(a.u, a.v);
            const pick = (r >= thr) ? pair.a : pair.b;
            this.colorByKey.set(this.key(a), pick);
        }
        this.renderAll();
    }
    updateCount() { this.countLabel.textContent = String(this.order.length); }
}
function main() {
    const host = document.getElementById('svgHost');
    if (!host)
        return;
    const model = new Honeycomb(host);
    const palette = new PaletteManager();
    model.setColorProvider(() => { var _a; return (_a = palette.selected) === null || _a === void 0 ? void 0 : _a.value; });
    model.enableManual();
    window.honeyModel = model;
    window.paletteManager = palette;
    document.getElementById('btnAddOne').onclick = () => model.addOne();
    document.getElementById('btnAddSix').onclick = () => model.addSix();
    document.getElementById('btnAddRing').onclick = () => model.addRing();
    document.getElementById('btnAddRng').onclick = () => { const cols = (new PaletteManager()).colors.map(c => c.value); if (!cols.length)
        return; const total = Math.ceil(cols.length * 1.7); const picks = []; for (const c of cols)
        picks.push(c); while (picks.length < total) {
        picks.push(cols[Math.floor(Math.random() * cols.length)]);
    } for (let i = picks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = picks[i];
        picks[i] = picks[j];
        picks[j] = t;
    } for (const c of picks) {
        model.addAnywhereWithColor(c) || model.addRandomWithColor(c);
    } };
    document.getElementById('btnAddRandomColor').onclick = () => {
        var _a;
        const strat = ((_a = document.getElementById('strategySelect')) === null || _a === void 0 ? void 0 : _a.value) || 'frontier';
        if (strat === 'clock') {
            const all = palette.colors;
            if (!all.length)
                return;
            const pick = all[Math.floor(Math.random() * all.length)].value;
            model.addClockWithColor(pick);
        }
        else if (strat === 'clock2') {
            const all = palette.colors;
            if (!all.length)
                return;
            const pick = all[Math.floor(Math.random() * all.length)].value;
            model.addClockV2WithColor(pick);
        }
        else if (strat === 'clock3') {
            const all = palette.colors;
            if (!all.length)
                return;
            const pick = all[Math.floor(Math.random() * all.length)].value;
            model.addClockV3WithColor(pick);
        }
        else if (strat === 'ca-color') {
            model.addCAColorStep('majority2');
        }
        else {
            const sel = palette.selected;
            if (!sel)
                return;
            model.addRandomWithColor(sel.value);
        }
    };
    document.getElementById('btnAddRandomAny').onclick = () => { var _a; const all = palette.colors; if (!all.length)
        return; const pick = all[Math.floor(Math.random() * all.length)].value; const strat = ((_a = document.getElementById('strategySelect')) === null || _a === void 0 ? void 0 : _a.value) || 'frontier'; if (strat === 'clock')
        model.addClockWithColor(pick);
    else if (strat === 'clock2')
        model.addClockV2WithColor(pick);
    else if (strat === 'clock3')
        model.addClockV3WithColor(pick);
    else if (strat === 'ca-color')
        model.addCAColorStep('majority2');
    else
        model.addRandomWithColor(pick); };
    const imgSampler = new ImageSampler();
    const fileInput = document.getElementById('imgFile');
    const fitSelect = document.getElementById('imgFit');
    const btnMapNow = document.getElementById('btnMapNow');
    if (fileInput)
        fileInput.onchange = async () => {
            const f = fileInput.files && fileInput.files[0];
            if (f) {
                try {
                    await imgSampler.loadFile(f);
                }
                catch (e) {
                    console.error('image load error', e);
                }
            }
        };
    if (btnMapNow)
        btnMapNow.onclick = async () => {
            var _a;
            if (!imgSampler.isReady()) {
                console.warn('No image loaded');
                return;
            }
            const fit = ((fitSelect === null || fitSelect === void 0 ? void 0 : fitSelect.value) || 'cover');
            // Build full honeycomb first
            let guard = 0;
            while (model.addOne()) {
                if (++guard > 150000)
                    break;
            }
            const pal = palette.colors;
            const modeSel = document.getElementById('fillMode');
            const mode = ((modeSel === null || modeSel === void 0 ? void 0 : modeSel.value) || 'v1');
            if (mode === 'v2') {
                model.applyDitherMixFromSampler(imgSampler, fit, pal);
            }
            else {
                const o = model;
                const order = o.order || [];
                for (const a of order) {
                    const p = o.axialToPoint(a);
                    const rgb = imgSampler.sampleAt(p, o.areaW, o.areaH, fit) || { r: 16, g: 19, b: 26 };
                    let best = ((_a = pal[0]) === null || _a === void 0 ? void 0 : _a.value) || '#000';
                    let bestD = Infinity;
                    for (const e of pal) {
                        const pr = parseCssColorToRgb(e.value) || { r: 0, g: 0, b: 0 };
                        const d = rgbDist2(rgb, pr);
                        if (d < bestD) {
                            bestD = d;
                            best = e.value;
                        }
                    }
                    o.colorByKey.set(o.key(a), best);
                }
                o.renderAll();
            }
        };
}
document.addEventListener('DOMContentLoaded', main);
function nearestTwoFromPalette(rgb, palette) {
    let bestA = '#000000', bestB = '#000000';
    let da = Infinity, db = Infinity;
    for (const e of palette) {
        const pr = parseCssColorToRgb(e.value) || { r: 0, g: 0, b: 0 };
        const d = rgbDist2(rgb, pr);
        if (d < da) {
            db = da;
            bestB = bestA;
            da = d;
            bestA = e.value;
        }
        else if (d < db) {
            db = d;
            bestB = e.value;
        }
    }
    if (bestB === bestA && palette.length > 1) {
        const alt = palette.find(x => x.value !== bestA);
        if (alt) {
            bestB = alt.value;
            db = rgbDist2(rgb, parseCssColorToRgb(bestB));
        }
    }
    return { a: bestA, b: bestB, da, db };
}
const BAYER8 = [
    0, 48, 12, 60, 3, 51, 15, 63,
    32, 16, 44, 28, 35, 19, 47, 31,
    8, 56, 4, 52, 11, 59, 7, 55,
    40, 24, 36, 20, 43, 27, 39, 23,
    2, 50, 14, 62, 1, 49, 13, 61,
    34, 18, 46, 30, 33, 17, 45, 29,
    10, 58, 6, 54, 9, 57, 5, 53,
    42, 26, 38, 22, 41, 25, 37, 21
].map(v => v / 64);
function bayer8(u, v) { const i = ((u % 8) + 8) % 8, j = ((v % 8) + 8) % 8; return BAYER8[j * 8 + i]; }
// ImageSampler + color distance helpers
class ImageSampler {
    constructor() {
        this.w = 0;
        this.h = 0;
        this.data = null;
        this.canvas = document.createElement('canvas');
        const c = this.canvas.getContext('2d');
        if (!c)
            throw new Error('2d');
        this.ctx = c;
    }
    async loadFile(file) { const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(file); }); const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = e => rej(e); im.src = url; }); this.w = img.naturalWidth || img.width; this.h = img.naturalHeight || img.height; this.canvas.width = this.w; this.canvas.height = this.h; this.ctx.drawImage(img, 0, 0); this.data = this.ctx.getImageData(0, 0, this.w, this.h); }
    isReady() { return !!this.data; }
    sampleAt(p, areaW, areaH, fit) { if (!this.data)
        return null; const imgW = this.w, imgH = this.h; let sx = areaW / imgW, sy = areaH / imgH; if (fit === 'cover') {
        const s = Math.max(sx, sy);
        sx = sy = s;
    }
    else if (fit === 'contain') {
        const s = Math.min(sx, sy);
        sx = sy = s;
    } const offX = (areaW - imgW * sx) / 2, offY = (areaH - imgH * sy) / 2; const ax = p.x + areaW / 2, ay = p.y + areaH / 2; const ix = (ax - offX) / sx, iy = (ay - offY) / sy; const x = Math.floor(ix), y = Math.floor(iy); if (x < 0 || y < 0 || x >= imgW || y >= imgH)
        return null; const i = (y * imgW + x) * 4, d = this.data.data; return { r: d[i], g: d[i + 1], b: d[i + 2] }; }
}
function srgbToLinear(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function rgbDist2(a, b) { const ar = srgbToLinear(a.r), ag = srgbToLinear(a.g), ab = srgbToLinear(a.b); const br = srgbToLinear(b.r), bg = srgbToLinear(b.g), bb = srgbToLinear(b.b); const dr = ar - br, dg = ag - bg, db = ab - bb; return dr * dr + dg * dg + db * db; }
