// src/ca_v2.ts
// CA v2: per-color birth + minimal-island focus + bridging

interface Window { honeyModel?: any; }

declare var CARules: any;

type Axial = { u: number; v: number };

type ColorEntry = { id: string; name: string; value: string };

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
