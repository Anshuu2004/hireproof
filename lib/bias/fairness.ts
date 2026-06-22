/**
 * Four-fifths (80%) rule fairness computation — the standard NYC Local Law 144 /
 * EEOC adverse-impact test, run over cohort counts. Kept pure + deterministic so
 * it is testable and the audit is reproducible. The DB only returns grouped
 * counts (hp_bias_cohorts); ALL ratio + suppression logic lives here.
 *
 * `selected` = candidates whose AI-collaboration score is at/above the pass
 * threshold (the "selection" event). The impact ratio for a dimension is
 * min(selectionRate) / max(selectionRate) across its groups; >= 0.8 passes.
 *
 * Cell suppression (k-anonymity): groups smaller than `minCell` are excluded
 * from the ratio and flagged `suppressed` — they are never reported individually.
 */
export interface CohortRow {
  dimension: string;
  grp: string;
  total: number;
  selected: number;
}

export interface GroupReport {
  group: string;
  total: number;
  selected: number;
  rate: number | null; // selection rate, null when suppressed
  suppressed: boolean;
}

export interface DimensionReport {
  dimension: string;
  groups: GroupReport[];
  impactRatio: number | null; // min/max selection rate across evaluable groups
  pass: boolean | null; // impactRatio >= 0.8; null when not evaluable
  evaluable: boolean;
  note?: string;
}

export interface FairnessReport {
  passThreshold: number;
  minCell: number;
  rule: "four-fifths (80%)";
  dimensions: DimensionReport[];
  evaluableDimensions: number;
  overallPass: boolean | null; // null when nothing is evaluable yet
}

const DIMENSION_LABELS: Record<string, string> = {
  gender: "Gender",
  age_band: "Age band",
  region: "Region",
  category: "Category",
  language: "Language (proxy)",
};

export function dimensionLabel(dim: string): string {
  return DIMENSION_LABELS[dim] ?? dim;
}

export function buildFairnessReport(
  rows: CohortRow[],
  opts: { passThreshold: number; minCell: number }
): FairnessReport {
  const { passThreshold, minCell } = opts;

  // group rows by dimension, preserving a stable dimension order
  const order = ["gender", "age_band", "region", "category", "language"];
  const byDim = new Map<string, CohortRow[]>();
  for (const r of rows) {
    if (!byDim.has(r.dimension)) byDim.set(r.dimension, []);
    byDim.get(r.dimension)!.push(r);
  }
  const dims = [...byDim.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  const dimensions: DimensionReport[] = dims.map((dim) => {
    const groups: GroupReport[] = byDim
      .get(dim)!
      .map((r) => {
        const suppressed = r.total < minCell;
        return {
          group: r.grp,
          total: r.total,
          selected: r.selected,
          rate: suppressed || r.total === 0 ? null : r.selected / r.total,
          suppressed,
        };
      })
      .sort((a, b) => a.group.localeCompare(b.group));

    const evaluableGroups = groups.filter((g) => !g.suppressed && g.rate != null);
    if (evaluableGroups.length < 2) {
      return {
        dimension: dim,
        groups,
        impactRatio: null,
        pass: null,
        evaluable: false,
        note: `Needs ≥2 groups of at least ${minCell} candidates to evaluate.`,
      };
    }

    const rates = evaluableGroups.map((g) => g.rate as number);
    const maxRate = Math.max(...rates);
    const minRate = Math.min(...rates);
    if (maxRate === 0) {
      return {
        dimension: dim,
        groups,
        impactRatio: null,
        pass: null,
        evaluable: false,
        note: "No selections above the threshold yet.",
      };
    }

    const impactRatio = minRate / maxRate;
    return {
      dimension: dim,
      groups,
      impactRatio,
      pass: impactRatio >= 0.8,
      evaluable: true,
    };
  });

  const evaluable = dimensions.filter((d) => d.evaluable);
  const overallPass = evaluable.length === 0 ? null : evaluable.every((d) => d.pass === true);

  return {
    passThreshold,
    minCell,
    rule: "four-fifths (80%)",
    dimensions,
    evaluableDimensions: evaluable.length,
    overallPass,
  };
}

/** Lowest impact ratio across evaluable dimensions — the headline number stored
 *  in bias_audit_runs.selection_rate_ratio. Null when nothing is evaluable. */
export function worstImpactRatio(report: FairnessReport): number | null {
  const ratios = report.dimensions
    .filter((d) => d.evaluable && d.impactRatio != null)
    .map((d) => d.impactRatio as number);
  return ratios.length ? Math.min(...ratios) : null;
}
