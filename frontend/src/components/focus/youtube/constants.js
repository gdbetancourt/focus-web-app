export const STAGES = [
  {
    key: "programado",
    label: "Video Programado",
    color: "bg-blue-600",
    textColor: "text-blue-400",
    badgeColor: "bg-blue-500/20 text-blue-400",
    requiredFields: [],
    requiredLabel: null,
  },
  {
    key: "referencias",
    label: "Referencias Compiladas",
    color: "bg-indigo-600",
    textColor: "text-indigo-400",
    badgeColor: "bg-indigo-500/20 text-indigo-400",
    requiredFields: ["notebook_lm_link"],
    requiredLabel: "Link de NotebookLM",
  },
  {
    key: "reporte",
    label: "Reporte de Patrones",
    color: "bg-purple-600",
    textColor: "text-purple-400",
    badgeColor: "bg-purple-500/20 text-purple-400",
    requiredFields: ["report_file_id"],
    requiredLabel: "Archivo de reporte",
  },
  {
    key: "metodos",
    label: "Metodos Aplicados",
    color: "bg-violet-600",
    textColor: "text-violet-400",
    badgeColor: "bg-violet-500/20 text-violet-400",
    requiredFields: ["methods_file_id"],
    requiredLabel: "Archivo de metodos",
  },
  {
    key: "guion",
    label: "Guion Redactado",
    color: "bg-amber-600",
    textColor: "text-amber-400",
    badgeColor: "bg-amber-500/20 text-amber-400",
    requiredFields: ["script_file_id"],
    requiredLabel: "Archivo de guion",
  },
  {
    key: "grabado",
    label: "Video Grabado",
    color: "bg-orange-600",
    textColor: "text-orange-400",
    badgeColor: "bg-orange-500/20 text-orange-400",
    requiredFields: [],
    requiredLabel: null,
  },
  {
    key: "publicado",
    label: "Video Publicado",
    color: "bg-green-600",
    textColor: "text-green-400",
    badgeColor: "bg-green-500/20 text-green-400",
    requiredFields: ["youtube_url"],
    requiredLabel: "Link de YouTube",
  },
];

export const getStageByKey = (key) => STAGES.find((s) => s.key === key);

export const getStageIndex = (key) => STAGES.findIndex((s) => s.key === key);

export const FORMAT_BADGES = {
  short: { label: "Short", className: "bg-cyan-500/20 text-cyan-400" },
  long: { label: "Long", className: "bg-pink-500/20 text-pink-400" },
};
