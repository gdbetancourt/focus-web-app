"""
Case Stage Constants - Unified stage management for Cases
Stage 3 = Sales process (Ventas)
Stage 4 = Delivery process (Entrega)
"""

# Stage 3: Sales/Ventas stages
STAGE_3_VALUES = [
    "caso_solicitado",
    "caso_presentado", 
    "interes_en_caso",
    "cierre_administrativo"
]

# Stage 4: Delivery stages
STAGE_4_VALUES = [
    "ganados",
    "concluidos",
    "contenidos_transcritos",
    "reporte_presentado",
    "caso_publicado"
]

# All valid case stages
ALL_CASE_STAGES = STAGE_3_VALUES + STAGE_4_VALUES

# Stage labels for display
STAGE_3_LABELS = {
    "caso_solicitado": "Caso Solicitado",
    "caso_presentado": "Caso Presentado",
    "interes_en_caso": "Interés en Caso",
    "cierre_administrativo": "Cierre Administrativo"
}

STAGE_4_LABELS = {
    "ganados": "Ganados",
    "concluidos": "Concluidos",
    "contenidos_transcritos": "Contenidos Transcritos",
    "reporte_presentado": "Reporte Presentado",
    "caso_publicado": "Caso Publicado"
}

ALL_STAGE_LABELS = {**STAGE_3_LABELS, **STAGE_4_LABELS}


def get_stage_phase(stage: str) -> int:
    """
    Get the phase (3 or 4) for a given stage value.
    Returns 0 if stage is not recognized.
    """
    if stage in STAGE_3_VALUES:
        return 3
    elif stage in STAGE_4_VALUES:
        return 4
    return 0


def is_stage_3(stage: str) -> bool:
    """Check if stage is a Stage 3 (Sales) stage"""
    return stage in STAGE_3_VALUES


def is_stage_4(stage: str) -> bool:
    """Check if stage is a Stage 4 (Delivery) stage"""
    return stage in STAGE_4_VALUES


def get_stage_label(stage: str) -> str:
    """Get human-readable label for a stage"""
    return ALL_STAGE_LABELS.get(stage, stage)


def validate_stage_transition(current_stage: str, new_stage: str) -> tuple[bool, str]:
    """
    Validate if a stage transition is allowed.
    Rules:
    - Within Stage 3: Any transition allowed
    - Within Stage 4: Any transition allowed
    - Stage 3 -> Stage 4: Only via "Move to Delivery" action (sets to "ganados")
    - Stage 4 -> Stage 3: Only via "Return to Cases" action (sets to "cierre_administrativo")
    
    Returns: (is_valid, error_message)
    """
    current_phase = get_stage_phase(current_stage)
    new_phase = get_stage_phase(new_stage)
    
    if current_phase == 0:
        return True, ""  # Unknown current stage, allow
    
    if new_phase == 0:
        return False, f"Estado '{new_stage}' no es válido"
    
    # Same phase - always allowed
    if current_phase == new_phase:
        return True, ""
    
    # Cross-phase transitions should be done via specific actions
    if current_phase == 3 and new_phase == 4:
        return False, "Use 'Mover a Delivery' para pasar a Stage 4"
    
    if current_phase == 4 and new_phase == 3:
        return False, "Use 'Devolver a Cases' para regresar a Stage 3"
    
    return True, ""
