// src/ca_rules.ts
// Cellular Automata rules per color (no modules; attaches to window as CARules)

type ColorEntry = { id: string; name: string; value: string; ruleKey?: string };

namespace CARules {
  export type ColorCounts = { total: number; byColor: Map<string, number> };
  export type ColorRuleFn = (ctx: ColorCounts, targetColor: string) => boolean;

  export interface Rule { key: string; name: string; desc: string; fn: ColorRuleFn; }

  const rules: Record<string, Rule> = {
    B2: { key: 'B2', name: 'Birth ≥2 same-color neighbors', desc: 'Spawn if at least 2 neighbors of this color', fn: (ctx, color) => (ctx.byColor.get(color) || 0) >= 2 },
    B3: { key: 'B3', name: 'Birth ≥3 same-color neighbors', desc: 'Spawn if at least 3 neighbors of this color', fn: (ctx, color) => (ctx.byColor.get(color) || 0) >= 3 },
    Dom: { key: 'Dom', name: 'Dominate neighbors', desc: 'Spawn if this color has strictly most neighbors', fn: (ctx, color) => { const v = ctx.byColor.get(color) || 0; let maxOther = 0; for (const [c, n] of ctx.byColor) if (c !== color && n > maxOther) maxOther = n; return v > maxOther && v > 0; } },
  };

  const LS_KEY = 'honeycomb.caRules.v1';

  export function registry(): Rule[] { return Object.values(rules); }
  export function getRule(key?: string): Rule { return rules[key || 'B2'] || rules['B2']; }

  export type RuleMap = Record<string, string>; // colorId -> ruleKey

  export function getRulesForPalette(palette: ColorEntry[]): RuleMap {
    let map: RuleMap = {};
    try { const raw = localStorage.getItem(LS_KEY); if (raw) map = JSON.parse(raw) as RuleMap; } catch {}
    for (const c of palette) if (!map[c.id]) map[c.id] = c.ruleKey || 'B2';
    return map;
  }

  export function setRuleForColor(colorId: string, ruleKey: string) {
    let map: RuleMap = {};
    try { const raw = localStorage.getItem(LS_KEY); if (raw) map = JSON.parse(raw) as RuleMap; } catch {}
    map[colorId] = rules[ruleKey] ? ruleKey : 'B2';
    try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch {}
  }

  export function decideBirthColor(ctx: ColorCounts, palette: ColorEntry[], selectedId: string | undefined, ruleMap: RuleMap): string | null {
    const eligible: { color: string; n: number; pri: number }[] = [];
    for (const c of palette) {
      const rk = ruleMap[c.id] || c.ruleKey || 'B2';
      const rule = getRule(rk);
      if (rule.fn(ctx, c.value)) {
        const n = ctx.byColor.get(c.value) || 0;
        const pri = (c.id === selectedId ? 1 : 2);
        eligible.push({ color: c.value, n, pri });
      }
    }
    if (!eligible.length) return null;
    eligible.sort((a,b)=> a.pri!==b.pri ? a.pri-b.pri : (b.n - a.n));
    return eligible[0].color;
  }
}
