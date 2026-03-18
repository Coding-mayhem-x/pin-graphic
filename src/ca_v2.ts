// Clean CA v2: iterate fairly across colors and their islands (components)
// No dependencies on palette selection; driven only by Add Random (any) auto-run.
(function(){
  const ST:any = (window as any).CA_V2 || ((window as any).CA_V2 = { state: { colorOrder: [] as string[], colorPtr: 0, compPtr: {} as Record<string, number> } });

  function M(): any { return (window as any).honeyModel; }
  function key(a:any): string { const m=M(); return m.key(a); }
  function within(a:any): boolean { const m=M(); return m.withinArea(m.axialToPoint(a)); }

  function colorsPresent(): string[]{
    const m:any = M(); const s = new Set<string>(); if(m && m.colorByKey){ for(const v of m.colorByKey.values()){ if(v) s.add(v as string); } }
    const arr = Array.from(s.values()); arr.sort(); return arr;
  }
  function refreshOrder(){
    const st=ST.state; const now = colorsPresent(); st.colorOrder = now; if(st.colorPtr >= now.length) st.colorPtr = 0; // trim
    // keep comp pointers per color
    const cur = st.compPtr; const next:Record<string,number> = {}; for(const c of now){ next[c] = (cur[c]||0); }
    st.compPtr = next;
  }
  function compsOf(col:string): any[]{ const m:any = M(); try { return m.componentsOfColor ? m.componentsOfColor(col) : []; } catch { return []; } }
  function freeNeighbors(comp:any[]): any[]{ const m:any=M(); try { return m.freeNeighbors ? m.freeNeighbors(comp) : []; } catch { return []; } }
  function neighCounts(a:any): Map<string,number>{ const m:any=M(); const map=new Map<string,number>(); for(const n of m.neighbors(a)){ const nk=key(n); if(m.placed.has(nk)){ const c=m.colorByKey.get(nk); if(c){ map.set(c, (map.get(c)||0)+1); } } } return map; }

  function pickForComp(col:string, comp:any[]): {a:any,color:string}|null{
    const frees = freeNeighbors(comp); if(!frees || !frees.length) return null;
    let best:any=null;
    // 1) Prefer boundary touching both self and others
    for(const f of frees){ const by=neighCounts(f); const total=Array.from(by.values()).reduce((s,n)=>s+n,0); if(total===0) continue; const nSame=by.get(col)||0; const nDiff=total-nSame; if(nSame>=1 && nDiff>=1 && within(f)){ const score=100+nSame*10+nDiff*5; if(!best||score>best.score) best={a:f,color:col,score}; } }
    if(best) return {a:best.a,color:col};
    // 2) Self-adjacent
    for(const f of frees){ const by=neighCounts(f); const nSame=by.get(col)||0; if(nSame>=1 && within(f)) return {a:f,color:col}; }
    // 3) Gentle bridging if mixed neighbors exist
    for(const f of frees){ const by=neighCounts(f); const total=Array.from(by.values()).reduce((s,n)=>s+n,0); if(total>=2 && within(f)) return {a:f,color:col}; }
    // 4) Last resort: any valid neighbor to unblock tiny singles
    for(const f of frees){ if(within(f)) return {a:f,color:col}; }
    return null;
  }

  function place(pick:{a:any,color:string}): boolean{
    const m:any=M(); const k = key(pick.a); m.frontier.delete(k); const p = m.axialToPoint(pick.a); if(!m.withinArea(p)) return false; m.place(pick.a,pick.color); m.renderCircle(pick.a,p); m.updateCount(); return true;
  }

  function step(): boolean{
    const m:any=M(); if(!m) return false; refreshOrder(); const st=ST.state; const colors=st.colorOrder; if(!colors.length) return false;
    // Snapshot per-color components and total count
    let total = 0; const compsBy: Record<string, any[][]> = {} as any;
    for(const c of colors){ const comps = compsOf(c).filter(x=>x && x.length); compsBy[c]=comps; total += comps.length; st.compPtr[c] = st.compPtr[c] || 0; }
    if(total===0) return false;
    for(let tries=0; tries<total; tries++){
      const c = colors[st.colorPtr % colors.length]; const comps = compsBy[c]; st.colorPtr = (st.colorPtr+1) % colors.length; if(!comps.length) continue;
      const i = st.compPtr[c] % comps.length; st.compPtr[c] = (st.compPtr[c]+1) % Math.max(1, comps.length);
      const comp = comps[i]; const pick = pickForComp(c, comp); if(pick){ return place(pick); }
    }
    return false;
  }

  function wire(){
    const sel = document.getElementById('strategySelect') as HTMLSelectElement | null; if(!sel) return;
    if(!Array.from(sel.options).some(o=>o.value==='ca-v2')){ const opt=document.createElement('option'); opt.value='ca-v2'; opt.textContent='CA v2'; sel.appendChild(opt); }
    const any = document.getElementById('btnAddRandomAny'); if(any){ any.addEventListener('click', function(ev){ const cur = (sel!.value||''); if(cur==='ca-v2'){ ev.stopImmediatePropagation(); ev.preventDefault(); step(); } }, true); }
  }

  document.addEventListener('DOMContentLoaded', wire);
})();
