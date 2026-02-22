/**
 * Loading Progress Component for Today's Focus
 * Shows a detailed progress bar with explanatory messages during data loading
 */
import { Progress } from "../ui/progress";
import { 
  RefreshCw, 
  Database, 
  Users, 
  FileText, 
  CheckCircle,
  MessageSquare,
  Linkedin,
  Mail,
  Loader2
} from "lucide-react";

// Map of loading steps to icons and colors
const STEP_CONFIG = {
  cases: { icon: Database, color: "text-amber-400", bg: "bg-amber-500/20" },
  contacts: { icon: Users, color: "text-teal-400", bg: "bg-teal-500/20" },
  quotes: { icon: FileText, color: "text-orange-400", bg: "bg-orange-500/20" },
  whatsapp: { icon: MessageSquare, color: "text-green-400", bg: "bg-green-500/20" },
  linkedin: { icon: Linkedin, color: "text-blue-400", bg: "bg-blue-500/20" },
  email: { icon: Mail, color: "text-purple-400", bg: "bg-purple-500/20" },
  default: { icon: RefreshCw, color: "text-[#ff3300]", bg: "bg-[#ff3300]/20" },
};

// Detect step type from message
const getStepConfig = (currentStep) => {
  if (!currentStep) return STEP_CONFIG.default;
  
  const stepLower = currentStep.toLowerCase();
  if (stepLower.includes("whatsapp")) return STEP_CONFIG.whatsapp;
  if (stepLower.includes("linkedin")) return STEP_CONFIG.linkedin;
  if (stepLower.includes("email") || stepLower.includes("correo")) return STEP_CONFIG.email;
  if (stepLower.includes("caso") || stepLower.includes("deal")) return STEP_CONFIG.cases;
  if (stepLower.includes("contacto") || stepLower.includes("rol")) return STEP_CONFIG.contacts;
  if (stepLower.includes("cotizaci")) return STEP_CONFIG.quotes;
  
  return STEP_CONFIG.default;
};

export function LoadingProgress({ loadingProgress, embedded = false }) {
  const { isLoading, currentStep, progress, totalSteps, completedSteps, details } = loadingProgress;

  if (!isLoading) {
    return null;
  }

  const config = getStepConfig(currentStep);
  const IconComponent = config.icon;

  return (
    <div 
      className={`bg-[#0a0a0a] border border-[#222] rounded-lg p-4 ${embedded ? 'mb-4' : 'mb-6'} animate-in fade-in slide-in-from-top-2 duration-300`}
      data-testid="loading-progress"
    >
      {/* Header with icon and message */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2.5 rounded-lg ${config.bg}`}>
          <IconComponent className={`w-5 h-5 ${config.color} animate-pulse`} />
        </div>
        <div className="flex-1">
          <p className="text-white text-sm font-medium">{currentStep}</p>
          {totalSteps > 1 && (
            <p className="text-slate-500 text-xs mt-0.5">
              Paso {Math.min(completedSteps + 1, totalSteps)} de {totalSteps}
            </p>
          )}
          {details && (
            <p className="text-slate-400 text-xs mt-1">{details}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {progress < 100 && (
            <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
          )}
          {progress === 100 && (
            <CheckCircle className="w-5 h-5 text-green-400" />
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      <Progress 
        value={progress} 
        className="h-2 bg-[#222]"
      />
      
      {/* Footer with status */}
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-slate-500">
          {progress < 100 ? "Preparando datos..." : "¡Listo!"}
        </span>
        <span className={progress === 100 ? "text-green-400 font-medium" : "text-slate-400"}>
          {progress}%
        </span>
      </div>
    </div>
  );
}

export default LoadingProgress;
