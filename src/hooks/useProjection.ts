import { useMemo } from "react";
import { useData } from "../context/DataContext";
import { runProjection, type ProjectionResult } from "../lib/projection";
import type { ScenarioOverrides } from "../lib/types";
import { ZERO_SCENARIO } from "../lib/types";

export function useProjection(
  scenario: ScenarioOverrides = ZERO_SCENARIO,
): ProjectionResult | null {
  const { snapshot } = useData();
  return useMemo(() => {
    if (!snapshot) return null;
    return runProjection(snapshot, scenario);
  }, [snapshot, scenario]);
}
