/**
 * Case Stage Constants - Unified stage management for Cases
 * Stage 3 = Sales process (Ventas)
 * Stage 4 = Delivery process (Entrega)
 */

// Stage 3: Sales/Ventas stages
export const STAGE_3_VALUES = [
  "caso_solicitado",
  "caso_presentado",
  "interes_en_caso",
  "cierre_administrativo"
];

// Stage 4: Delivery stages
export const STAGE_4_VALUES = [
  "ganados",
  "concluidos",
  "contenidos_transcritos",
  "reporte_presentado",
  "caso_publicado"
];

// All valid case stages
export const ALL_CASE_STAGES = [...STAGE_3_VALUES, ...STAGE_4_VALUES];

// Stage labels for display
export const STAGE_3_LABELS = {
  caso_solicitado: "Caso Solicitado"
};

export const STAGE_4_LABELS = {
  ganados: "Ganados",
  concluidos: "Concluidos",
  contenidos_transcritos: "Contenidos Transcritos",
  reporte_presentado: "Reporte Presentado",
  caso_publicado: "Caso Publicado"
};

export const ALL_STAGE_LABELS = { ...STAGE_3_LABELS, ...STAGE_4_LABELS };

// Stage colors for UI
export const STAGE_3_COLORS = {
  caso_solicitado: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  caso_presentado: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  interes_en_caso: "bg-green-500/20 text-green-400 border-green-500/50",
  cierre_administrativo: "bg-amber-500/20 text-amber-400 border-amber-500/50"
};

export const STAGE_4_COLORS = {
  ganados: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
  concluidos: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
  contenidos_transcritos: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  reporte_presentado: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  caso_publicado: "bg-amber-500/20 text-amber-400 border-amber-500/50"
};

export const ALL_STAGE_COLORS = { ...STAGE_3_COLORS, ...STAGE_4_COLORS };

/**
 * Get the phase (3 or 4) for a given stage value
 */
export function getStagePhase(stage) {
  if (STAGE_3_VALUES.includes(stage)) return 3;
  if (STAGE_4_VALUES.includes(stage)) return 4;
  return 0;
}

/**
 * Check if stage is a Stage 3 (Sales) stage
 */
export function isStage3(stage) {
  return STAGE_3_VALUES.includes(stage);
}

/**
 * Check if stage is a Stage 4 (Delivery) stage
 */
export function isStage4(stage) {
  return STAGE_4_VALUES.includes(stage);
}

/**
 * Get human-readable label for a stage
 */
export function getStageLabel(stage) {
  return ALL_STAGE_LABELS[stage] || stage;
}

/**
 * Get color classes for a stage
 */
export function getStageColor(stage) {
  return ALL_STAGE_COLORS[stage] || "bg-slate-500/20 text-slate-400 border-slate-500/50";
}
