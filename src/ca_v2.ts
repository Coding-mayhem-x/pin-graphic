// src/ca_v2.ts
// CA v2: per-color birth + minimal-island focus + bridging

interface Window { honeyModel?: any; }




(function(){
  function getModel(): any { return (window as any).honeyModel; }
  function key(a: Axial){ return a.u+","+a.v; }

  function pickMinimalIsland(model: any, palette: ColorEntry[]): {color:string, comp: Axial[]} | null {
    let bestColor: string | null = null; let bestComp: Axial[] | null = null; let bestSize = Infinity;
    const colors = palette.map(p=>p.value);
    for(const color of colors){ const comps = model.componentsOfColor ? model.componentsOfColor(color) : []; for(const c of comps){ if(c.length>0 && c.length < bestSize){ bestSize=c.length; bestComp=c; bestColor=color; } } }
    if(bestComp && bestColor) return { color: bestColor, comp: bestComp };
    return null;
  }

  function frontierNeighbors(model:any, a:Axial): Map<string, number>{
    const m = new Map<string, number>(); const neigh = model.neighbors(a);
    for(const n of neigh){ const nk = key(n); if(model.placed && model.placed.has(nk)){ const col = model.colorByKey.get(nk); if(col){ m.set(col, (m.get(col)||0)+1); } } }
    return m;
  }

  function findBestCAV2(model:any, palette: ColorEntry[], selectedId?: string): {a:Axial,color:string}|null{
    const selected = selectedId ? (palette.find(p=>p.id===selectedId)?.value) : undefined;
    // 1) If minimal island exists, try to grow it first
    const min = pickMinimalIsland(model, palette);
    if(min){ const frees = model.freeNeighbors(min.comp); let best:any=null; for(const f of frees){ const by=frontierNeighbors(model,f); const ctx={total:Array.from(by.values()).reduce((s,n)=>s+n,0), counts: by}; let pick:string|null=null; if(selected && (ctx.total>=2)) pick=selected; else if(selected && (by.get(selected)||0)>=1 && (min && min.color===selected)) pick=selected; if(!pick && (window as any).CARules && (window as any).CARules.getRule){ pick = CARules.getRule('majority2').birth(ctx); } if(pick){ const pt=model.axialToPoint(f); if(model.withinArea(pt)) { best={a:f,color:pick}; break; } } }
      if(best) return best;
    }
    // 2) Otherwise scan global frontier and use majority2 or bridging by selected
    let best:any=null; for(const k of model.frontier){ const [u,v]=k.split(',').map((t:string)=>parseInt(t,10)); const a={u,v}; const by=frontierNeighbors(model,a); const total=Array.from(by.values()).reduce((s,n)=>s+n,0); if(total===0) continue; let pick:string|null=null; if(selected && total>=2) pick=selected; if(!pick && (window as any).CARules && (window as any).CARules.getRule){ pick = CARules.getRule('majority2').birth({total,counts:by}); } if(!pick) continue; const pt=model.axialToPoint(a); if(!model.withinArea(pt)) continue; // simple score: prefer fewer neighbors to help gaps
      const nSame = by.get(pick)||0; const score = (min?1:0)*1000 + nSame*10 - total; if(!best || score>best.score) best={a,color:pick,score}; }
    return best ? {a:best.a,color:best.color} : null;
  }

  function placeCAV2(){
    const model:any = getModel(); if(!model) return false;
    const pal: any = (window as any).paletteManager;
    const palette = pal.colors; const selectedId = pal.selected?.id;
    const pick = findBestCAV2(model, palette, selectedId);
    if(!pick) return false; const k = key(pick.a); model.frontier.delete(k); const p = model.axialToPoint(pick.a); if(!model.withinArea(p)) return false; model.place(pick.a, pick.color); model.renderCircle(pick.a, p); model.updateCount(); return true;
  }

  function interceptRunner(){
    const sel = document.getElementById('strategySelect') as HTMLSelectElement | null;
    if(!sel) return;
    if(!Array.from(sel.options).some(o=>o.value==='ca-v2')){
      const opt = document.createElement('option'); opt.value='ca-v2'; opt.textContent='CA v2'; sel.appendChild(opt);
    }
    const btnAny = document.getElementById('btnAddRandomAny'); if(btnAny){ btnAny.addEventListener('click', function(ev){ const cur = (sel.value||''); if(cur==='ca-v2'){ ev.stopImmediatePropagation(); ev.preventDefault(); placeCAV2(); } }, true); }
    const btnSel = document.getElementById('btnAddRandomColor'); if(btnSel){ btnSel.addEventListener('click', function(ev){ const cur = (sel.value||''); if(cur==='ca-v2'){ ev.stopImmediatePropagation(); ev.preventDefault(); placeCAV2(); } }, true); }
  }

  document.addEventListener('DOMContentLoaded', interceptRunner);
})();
// CA v2 fairness update: round-robin per color, grow that color's smallest island first.
(function(){
  const g:any = (window as any);
  g.__caV2 = g.__caV2 || { idx: 0 };

  function rrIndex(n:number){ const g:any=(window as any).__caV2; if(!g) return 0; g.idx = (g.idx||0)%Math.max(1,n); const out=g.idx; g.idx=(g.idx+1)%Math.max(1,n); return out; }

  function smallestCompOfColor(model:any, color:string): any[] {
    const comps = model.componentsOfColor ? model.componentsOfColor(color) : [];
    let best:any[]|null = null; for(const c of comps){ if(!best || c.length < best.length) best = c; }
    return best || [];
  }

  function tryGrowColor(model:any, color:string): {a:any,color:string}|null{
    const comp = smallestCompOfColor(model, color); if(!comp.length) return null;
    const frees = model.freeNeighbors(comp);
    for(const f of frees){
      // B2 for this specific color, with gentle bridging if total >= 2
      const by = (function(){ const m=new Map<string,number>(); for(const n of model.neighbors(f)){ const nk = model.key(n); if(model.placed.has(nk)){ const col=model.colorByKey.get(nk); if(col){ m.set(col,(m.get(col)||0)+1); } } } return m; })();
      const total = Array.from(by.values()).reduce((s,n)=>s+n,0);
      const nSame = by.get(color)||0;
      if(nSame >= 2 || total >= 2){ const pt=model.axialToPoint(f); if(model.withinArea(pt)) return {a:f,color}; }
    }
    return null;
  }

  function placeCAV2_Fair(){
    const model:any = (window as any).honeyModel; const pal:any = (window as any).paletteManager; if(!model || !pal) return false;
    const palette = pal.colors as {value:string}[]; if(!palette.length) return false;
    const start = rrIndex(palette.length);
    for(let k=0;k<palette.length;k++){
      const color = palette[(start+k)%palette.length].value;
      const pick = tryGrowColor(model, color);
      if(pick){ const id = model.key(pick.a); model.frontier.delete(id); const p = model.axialToPoint(pick.a); if(!model.withinArea(p)) continue; model.place(pick.a, pick.color); model.renderCircle(pick.a, p); model.updateCount(); return true; }
    }
    // Fallback to previous global behavior when nothing eligible
    return (function(){ const sel = document.getElementById('strategySelect') as HTMLSelectElement | null; const prev = sel?.value; if(sel) sel.value = 'ca-v2'; try { return (function(){
      // reuse old placeCAV2 if present
      const F=(window as any).__placeCAV2_old; if(typeof F==='function') return F(); return false;
    })(); } finally { if(sel && prev) sel.value = prev; } })();
  }

  // Replace CA v2 handlers to call fair variant
  function rewire(){
    const sel = document.getElementById('strategySelect') as HTMLSelectElement | null; if(!sel) return;
    if(!Array.from(sel.options).some(o=>o.value==='ca-v2')){ const opt=document.createElement('option'); opt.value='ca-v2'; opt.textContent='CA v2'; sel.appendChild(opt); }
    const btnAny = document.getElementById('btnAddRandomAny'); if(btnAny){ btnAny.addEventListener('click', function(ev){ const cur = (sel.value||''); if(cur==='ca-v2'){ ev.stopImmediatePropagation(); ev.preventDefault(); placeCAV2_Fair(); } }, true); }
    const btnSel = document.getElementById('btnAddRandomColor'); if(btnSel){ btnSel.addEventListener('click', function(ev){ const cur = (sel.value||''); if(cur==='ca-v2'){ ev.stopImmediatePropagation(); ev.preventDefault(); placeCAV2_Fair(); } }, true); }
  }

  document.addEventListener('DOMContentLoaded', rewire);
})();

// CA v2 update: iterate over all existing color islands (components), not just colors.
(function(){
  const g:any = (window as any); g.__caV2 = g.__caV2 || {}; if(g.__caV2.compIdx===undefined) g.__caV2.compIdx=0;

  function colorsPresent(model:any): string[]{
    const s = new Set<string>(); if(model && model.colorByKey){ for(const v of model.colorByKey.values()) if(v) s.add(v); }
    return Array.from(s.values());
  }
  function allComponents(model:any): {color:string, comp:any[]}[]{
    const out: {color:string, comp:any[]}[] = []; for(const col of colorsPresent(model)){ const comps = model.componentsOfColor ? model.componentsOfColor(col) : []; for(const c of comps){ if(c && c.length) out.push({color:col, comp:c}); } }
    // stable order: smallest first to help tiny islands
    out.sort((a,b)=>a.comp.length-b.comp.length);
    return out;
  }
  function freeNeighbors(model:any, comp:any[]): any[]{ return model.freeNeighbors ? model.freeNeighbors(comp) : []; }
  function neighCounts(model:any, a:any): Map<string,number>{ const m=new Map<string,number>(); for(const n of model.neighbors(a)){ const nk = model.key(n); if(model.placed.has(nk)){ const c=model.colorByKey.get(nk); if(c) m.set(c,(m.get(c)||0)+1); } } return m; }

  // Interaction aware rule: prefer self if adjacent; if also adjacent to others, prefer boundary cells (more mixed) to encourage touching.
  function pickForComponent(model:any, entry:{color:string, comp:any[]}): {a:any,color:string}|null{
    const frees = freeNeighbors(model, entry.comp); if(!frees.length) return null;
    let best:any=null;
    for(const f of frees){
      const by = neighCounts(model,f); const total = Array.from(by.values()).reduce((s,n)=>s+n,0); const nSame = by.get(entry.color)||0; const nDiff = total - nSame;
      if(total===0) continue; // ignore isolated holes; we want to grow where there is contact
      // Score: prioritize boundary touching (nSame>=1 and nDiff>=1), then pure self (nSame>=1), then mixed (total>=2)
      let ok=false; let score=-1;
      if(nSame>=1 && nDiff>=1){ ok=true; score = 100 + nSame*10 + nDiff*5; }
      else if(nSame>=1){ ok=true; score = 80 + nSame*10; }
      else if(total>=2){ ok=true; score = 60 + nDiff*5; }
      if(ok){ const pt=model.axialToPoint(f); if(!model.withinArea(pt)) continue; if(!best || score>best.score) best={a:f,color:entry.color,score}; }
    }
    // If still none, allow seeding next to component (no neighbors filter) to unblock tiny singles
    if(!best){ for(const f of frees){ const pt=model.axialToPoint(f); if(model.withinArea(pt)){ best={a:f,color:entry.color,score:10}; break; } } }
    return best ? {a:best.a,color:best.color} : null;
  }

  function placeCAV2_AllIslands(){
    const model:any = (window as any).honeyModel; if(!model) return false;
    const comps = allComponents(model); if(!comps.length) return false;
    const g:any = (window as any).__caV2; const start = (g && typeof g.compIdx==='number') ? g.compIdx % comps.length : 0;
    for(let i=0;i<comps.length;i++){
      const idx = (start + i) % comps.length; const entry = comps[idx];
      const pick = pickForComponent(model, entry);
      if(pick){ const k = model.key(pick.a); model.frontier.delete(k); const p = model.axialToPoint(pick.a); if(!model.withinArea(p)) continue; model.place(pick.a, pick.color); model.renderCircle(pick.a, p); model.updateCount(); (window as any).__caV2.compIdx = idx+1; return true; }
    }
    (window as any).__caV2.compIdx = (start + 1) % comps.length; // advance to avoid getting stuck
    return false;
  }

  function rewireAllIslands(){
    const sel = document.getElementById('strategySelect') as HTMLSelectElement | null; if(!sel) return;
    if(!Array.from(sel.options).some(o=>o.value==='ca-v2')){ const opt=document.createElement('option'); opt.value='ca-v2'; opt.textContent='CA v2'; sel.appendChild(opt); }
    const btnAny = document.getElementById('btnAddRandomAny'); if(btnAny){ btnAny.addEventListener('click', function(ev){ const cur = (sel.value||''); if(cur==='ca-v2'){ ev.stopImmediatePropagation(); ev.preventDefault(); placeCAV2_AllIslands(); } }, true); }
    const btnSel = document.getElementById('btnAddRandomColor'); if(btnSel){ btnSel.addEventListener('click', function(ev){ const cur = (sel.value||''); if(cur==='ca-v2'){ ev.stopImmediatePropagation(); ev.preventDefault(); placeCAV2_AllIslands(); } }, true); }
  }

  document.addEventListener('DOMContentLoaded', rewireAllIslands);
})();
