import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../../lib/api";
import { BookOpen, RefreshCw } from "lucide-react";

// ── Chapter structure ────────────────────────────────────────
const PARTS = [
  {
    index: 0,
    label: "Parte 1 — Ideas Rebeldes",
    chapters: [
      { index: 0, num: 1, title: 'El Despertar y la "Idea Rebelde"' },
      { index: 1, num: 2, title: 'La Anatomia de la Maestria y la "Trifecta de la Comunicacion"' },
      { index: 2, num: 3, title: "El Llamado (Informar vs. Liderar)" },
      { index: 3, num: 4, title: "Retorica Aplicada a la Teoria de las Decisiones" },
      { index: 4, num: 5, title: "El Portal de la Razon y la Intuicion" },
      { index: 5, num: 6, title: "Afilar el Hacha (Las 6 Preguntas Fundamentales)" },
    ],
  },
  {
    index: 1,
    label: "Parte 2 — Encuentra tu Voz",
    chapters: [
      { index: 0, num: 7, title: "La Base Psicologica del Comunicador" },
      { index: 1, num: 8, title: "Arquetipo Natural: El Carismatico" },
      { index: 2, num: 9, title: "Arquetipo Natural: El Estratega" },
      { index: 3, num: 10, title: "Arquetipo Natural: El Cientifico" },
      { index: 4, num: 11, title: "Arquetipo Natural: El Narrador" },
      { index: 5, num: 12, title: "Arquetipo Natural: El Futurista" },
      { index: 6, num: 13, title: "Arquetipo Natural: El Predicador" },
      { index: 7, num: 14, title: "Arquetipo Evolucionado: El Visionario" },
      { index: 8, num: 15, title: "Arquetipo Evolucionado: El Maestro" },
      { index: 9, num: 16, title: "Arquetipo Evolucionado: El Profeta" },
    ],
  },
  {
    index: 2,
    label: "Parte 3 — Construye tu Mensaje",
    chapters: [
      { index: 0, num: 17, title: "Como captar la atencion de cualquier persona (Bloque 1: Promesa)" },
      { index: 1, num: 18, title: "Como ayudar a mi auditorio a superar la resistencia (Bloque 2: Historia)" },
      { index: 2, num: 19, title: "Como manufacturar el 'Momento Aha' (Bloque 3: Idea Paradigmatica)" },
      { index: 3, num: 20, title: "Como generar sentido de urgencia y credibilidad (Bloque 4: Punto de Inflexion)" },
      { index: 4, num: 21, title: "Como crear un legado de accion positiva (Bloque 5: Ruta de Liderazgo)" },
      { index: 5, num: 22, title: "Como convertir una presentacion en un movimiento (Bloque 6: Jaque Mate)" },
    ],
  },
];

const FIELDS = [
  { key: "objetivo_resultados", label: "Objetivo en Resultados", rows: 2 },
  { key: "objetivo_accion", label: "Objetivo en Accion", rows: 2 },
  { key: "objetivo_aprendizaje", label: "Objetivo en Aprendizaje", rows: 2 },
  { key: "objetivo_experiencia", label: "Objetivo en Experiencia", rows: 2 },
  { key: "fuentes", label: "Fuentes", rows: 4 },
  { key: "ideas_generales", label: "Ideas Generales", rows: 5 },
  { key: "primera_version", label: "Primera Version", rows: 10 },
  { key: "redaccion_humanizada", label: "Redaccion Humanizada", rows: 10 },
  { key: "version_ilustrada", label: "Version Ilustrada", rows: 5 },
];

const STATUS_OPTIONS = ["Sin iniciar", "En progreso", "Terminado"];
const STATUS_DOT = {
  "Sin iniciar": "#6b7280",
  "En progreso": "#f97316",
  "Terminado": "#22c55e",
};

const EMPTY_CAP = {
  status: "Sin iniciar",
  objetivo_palabras: 0,
  objetivo_resultados: "",
  objetivo_accion: "",
  objetivo_aprendizaje: "",
  objetivo_experiencia: "",
  fuentes: "",
  ideas_generales: "",
  primera_version: "",
  redaccion_humanizada: "",
  version_ilustrada: "",
};

function countWords(str) {
  if (!str || !str.trim()) return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export default function LibroRockstarsPage() {
  const [activePart, setActivePart] = useState(0);
  const [activeChapter, setActiveChapter] = useState(0);
  const [capData, setCapData] = useState({ ...EMPTY_CAP });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wordGoal, setWordGoal] = useState(50000);
  const [summary, setSummary] = useState([]);
  const [visitedWords, setVisitedWords] = useState({});
  const saveTimer = useRef(null);

  // Load goal + summary on mount
  useEffect(() => {
    (async () => {
      try {
        const [goalRes, sumRes] = await Promise.all([
          api.get("/libro/config/goal"),
          api.get("/libro/summary"),
        ]);
        setWordGoal(goalRes.data.value || 50000);
        setSummary(sumRes.data.capitulos || []);
      } catch (e) {
        console.warn("Error loading libro config:", e);
      }
    })();
  }, []);

  // Load chapter data
  const loadChapter = useCallback(async (pi, ci) => {
    setLoading(true);
    try {
      const res = await api.get(`/libro/capitulos/${pi}/${ci}`);
      const data = res.data || { ...EMPTY_CAP };
      setCapData(data);
      const wc = countWords(data.redaccion_humanizada || data.primera_version || "");
      setVisitedWords((prev) => ({ ...prev, [`${pi}-${ci}`]: wc }));
    } catch {
      setCapData({ ...EMPTY_CAP });
      setVisitedWords((prev) => ({ ...prev, [`${pi}-${ci}`]: 0 }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChapter(activePart, activeChapter);
  }, [activePart, activeChapter, loadChapter]);

  // Save with debounce
  const saveChapter = useCallback(
    (data) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaving(true);
      saveTimer.current = setTimeout(async () => {
        try {
          await api.put(`/libro/capitulos/${activePart}/${activeChapter}`, data);
          // Refresh summary
          const sumRes = await api.get("/libro/summary");
          setSummary(sumRes.data.capitulos || []);
        } catch (e) {
          console.warn("Error saving:", e);
        } finally {
          setSaving(false);
        }
      }, 700);
    },
    [activePart, activeChapter]
  );

  const updateField = (key, value) => {
    const next = { ...capData, [key]: value };
    setCapData(next);
    saveChapter(next);
    if (key === "redaccion_humanizada" || key === "primera_version") {
      const wc = countWords(next.redaccion_humanizada || next.primera_version || "");
      setVisitedWords((prev) => ({ ...prev, [`${activePart}-${activeChapter}`]: wc }));
    }
  };

  // Compute totals — real count for visited chapters, estimate for the rest
  let totalWords = 0;
  let hasEstimates = false;
  PARTS.forEach((p) => {
    p.chapters.forEach((ch) => {
      const key = `${p.index}-${ch.index}`;
      if (key in visitedWords) {
        totalWords += visitedWords[key];
      } else {
        const row = summary.find((r) => r.parte_index === p.index && r.capitulo_index === ch.index);
        if (row) {
          const best = (row.rh_len || 0) > 0 ? row.rh_len : (row.pv_len || 0);
          if (best > 0) {
            totalWords += Math.round(best / 5);
            hasEstimates = true;
          }
        }
      }
    });
  });
  const totalChapters = PARTS.reduce((s, p) => s + p.chapters.length, 0);
  const doneChapters = summary.filter((r) => r.status === "Terminado").length;

  // Get status for a chapter from summary
  const getChapStatus = (pi, ci) => {
    const row = summary.find((r) => r.parte_index === pi && r.capitulo_index === ci);
    return row?.status || "Sin iniciar";
  };

  const currentPart = PARTS[activePart];
  const currentChap = currentPart.chapters[activeChapter];
  const chapWords = countWords(capData.redaccion_humanizada || capData.primera_version || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0f1117", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px",
        borderBottom: "1px solid #1e2235",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ padding: 8, borderRadius: 8, background: "rgba(249,115,22,0.15)" }}>
            <BookOpen size={20} color="#f97316" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Rockstars del Storytelling</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {doneChapters}/{totalChapters} terminados — {hasEstimates ? "~" : ""}{totalWords.toLocaleString()} / {wordGoal.toLocaleString()} palabras
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: saving ? "#f97316" : "#22c55e", fontFamily: "monospace" }}>
          {saving ? "Guardando..." : "Guardado"}
        </div>
      </div>

      {/* Part Tabs */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid #1e2235",
        flexShrink: 0,
      }}>
        {PARTS.map((p) => (
          <button
            key={p.index}
            onClick={() => { setActivePart(p.index); setActiveChapter(0); }}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: activePart === p.index ? "2px solid #f97316" : "2px solid transparent",
              color: activePart === p.index ? "#f97316" : "#6b7280",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Body: chapter list + content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Chapter List */}
        <div style={{
          width: 220,
          minWidth: 220,
          borderRight: "1px solid #1e2235",
          overflowY: "auto",
          background: "#0b0d14",
        }}>
          {currentPart.chapters.map((ch) => {
            const isActive = ch.index === activeChapter;
            const st = getChapStatus(activePart, ch.index);
            return (
              <button
                key={ch.num}
                onClick={() => setActiveChapter(ch.index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "10px 14px",
                  background: isActive ? "#1a1d27" : "transparent",
                  border: "none",
                  borderLeft: isActive ? "2px solid #f97316" : "2px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 150ms",
                }}
              >
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: STATUS_DOT[st] || "#6b7280",
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 11,
                  color: isActive ? "#9ca3af" : "#4b5563",
                  fontFamily: "monospace",
                  flexShrink: 0,
                  width: 22,
                }}>
                  {String(ch.num).padStart(2, "0")}
                </span>
                <span style={{
                  fontSize: 12,
                  color: isActive ? "#fff" : "#9ca3af",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {ch.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Chapter Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 60px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
              <RefreshCw size={24} color="#f97316" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <>
              {/* Chapter header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.15em", color: "#f97316", marginBottom: 4 }}>
                    {currentPart.label.split("—")[0].trim()} — CAPITULO {currentChap.num}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{currentChap.title}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
                    {chapWords.toLocaleString()} palabras
                  </span>
                  <select
                    value={capData.status || "Sin iniciar"}
                    onChange={(e) => updateField("status", e.target.value)}
                    style={{
                      background: "#1a1d27",
                      border: "1px solid #2d3148",
                      color: STATUS_DOT[capData.status] || "#6b7280",
                      fontSize: 12,
                      fontFamily: "monospace",
                      padding: "5px 10px",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Objetivo en Palabras */}
              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>Objetivo en Palabras</label>
                <input
                  type="number"
                  value={capData.objetivo_palabras || 0}
                  onChange={(e) => updateField("objetivo_palabras", parseInt(e.target.value) || 0)}
                  style={{
                    ...inputStyle,
                    width: 140,
                  }}
                />
              </div>

              {/* Text fields */}
              {FIELDS.map((f) => (
                <div key={f.key} style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={labelStyle}>{f.label}</label>
                    {(capData[f.key] || "").trim() && (
                      <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>
                        {countWords(capData[f.key])} palabras
                      </span>
                    )}
                  </div>
                  <textarea
                    value={capData[f.key] || ""}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    rows={f.rows}
                    style={textareaStyle}
                    placeholder={`Escribe ${f.label.toLowerCase()}...`}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontFamily: "monospace",
  letterSpacing: "0.1em",
  color: "#6b7280",
  textTransform: "uppercase",
  marginBottom: 6,
};

const inputStyle = {
  background: "#1a1d27",
  border: "1px solid #2d3148",
  color: "#e2e8f0",
  fontSize: 14,
  fontFamily: "monospace",
  padding: "6px 10px",
  outline: "none",
};

const textareaStyle = {
  width: "100%",
  background: "#1a1d27",
  border: "1px solid #2d3148",
  color: "#e2e8f0",
  fontSize: 14,
  lineHeight: 1.7,
  padding: 14,
  outline: "none",
  resize: "vertical",
  fontFamily: "inherit",
};
