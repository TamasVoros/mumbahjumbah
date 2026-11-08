export const pickedWords = (raw: Record<string, unknown>) => [raw["pick"]].flat().filter((p): p is string => typeof p === "string");
