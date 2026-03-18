// src/ca_rules.ts
// Cellular Automata rules based on neighbor colors (no modules; global namespace)
namespace CARules {
  export type ColorCounts = { total: number; counts: Map<string, number> };
  export type BirthFn = (ctx: ColorCounts) => string | null;
  export interface Rule { key: string; description: string; birth: BirthFn; }

  // Majority rule with threshold >=2 same-colored neighbors
  const majority2: Rule = {
    key: 'majority2',
    description: 'Birth if at least 2 neighbors share a color; pick that color',
    birth: (ctx: ColorCounts) => {
      let bestColor: string | null = null; let best = 0;
      for (const [color, n] of ctx.counts.entries()) {
        if (n > best) { best = n; bestColor = color; }
      }
      if (bestColor && best >= 2) return bestColor;
      return null;
    }
  };

  // Tie-break: prefer darker majority (fallback)
  const majority2PreferDark: Rule = {
    key: 'majority2_dark',
    description: 'Like majority2; on ties prefer darker color',
    birth: (ctx: ColorCounts) => {
      let bestColor: string | null = null; let best = 0; let candidates: string[] = [];
      for (const [color, n] of ctx.counts.entries()) {
        if (n > best) { best = n; candidates = [color]; }
        else if (n === best) { candidates.push(color); }
      }
      if (best >= 2 && candidates.length) {
        if (candidates.length === 1) return candidates[0];
        // Prefer darker based on simple luminance
        const lum = (hex: string) => {
          const p = (s: string) => parseInt(s, 16) / 255;
          const h = hex.replace('#',''); const r = p(h.slice(0,2)), g=p(h.slice(2,4)), b=p(h.slice(4,6));
          return 0.2126*r + 0.7152*g + 0.0722*b;
        };
        candidates.sort((a,b) => lum(a) - lum(b));
        return candidates[0];
      }
      return null;
    }
  };

  const registry: Record<string, Rule> = {
    [majority2.key]: majority2,
    [majority2PreferDark.key]: majority2PreferDark,
  };

  export function getRule(key: string): Rule { return registry[key] || majority2; }
  export function list(): Rule[] { return Object.values(registry); }
}
