/**
 * SectionLayout - Base layout for all Focus sections
 * 
 * Includes:
 * - Company vision statement (fixed across all sections)
 * - Section-specific subheadline explaining contribution to vision
 * - Traffic light history (52 weeks for weekly, 90 days for daily)
 * - Left sidebar with numbered steps, "See more" details, and traffic rules
 */
import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Construction } from "lucide-react";
import { cn } from "../../lib/utils";
import api from "../../lib/api";

// Company Vision - displayed at the top of every section
const COMPANY_VISION = "We help bold leaders to communicate with impact so they can cut through the noise and lead meaningful change in their organization and the world.";

/**
 * Traffic Light History Component
 * Shows 52 weeks (weekly sections) or 90 days (daily sections)
 * Past periods are gray, current is colored based on status, future is gray
 */
function TrafficLightHistory({ isDaily = false, currentStatus = "gray", historyStatuses = [] }) {
  const totalPeriods = isDaily ? 90 : 52;
  
  // Get week number for current date
  const getWeekNumber = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil((diff + start.getDay() * 1000 * 60 * 60 * 24) / oneWeek);
  };
  
  // Get day of quarter
  const getDayOfQuarter = () => {
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    return Math.floor((now - quarterStart) / (1000 * 60 * 60 * 24)) + 1;
  };
  
  const actualCurrentPeriod = isDaily ? getDayOfQuarter() : getWeekNumber();
  
  const getStatusColor = (status) => {
    switch (status) {
      case "green": return "bg-green-500";
      case "yellow": return "bg-yellow-500";
      case "red": return "bg-red-500";
      default: return "bg-slate-600";
    }
  };

  return (
    <div className="w-full mb-6 p-4 bg-[#0a0a0a] rounded-lg border border-[#222]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
          {isDaily ? "Quarter Progress (90 days)" : "Year Progress (52 weeks)"}
        </span>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
          {isDaily ? `Day ${actualCurrentPeriod}` : `Week ${actualCurrentPeriod}`}
        </span>
      </div>
      <div className="flex gap-[2px] justify-between">
        {Array.from({ length: totalPeriods }, (_, i) => {
          const periodNumber = i + 1;
          const isPast = periodNumber < actualCurrentPeriod;
          const isCurrent = periodNumber === actualCurrentPeriod;
          const isFuture = periodNumber > actualCurrentPeriod;
          const historicalStatus = historyStatuses[i];
          // Only truthy non-null statuses count as "has real data"
          const hasHistoricalStatus = Boolean(historicalStatus) && historicalStatus !== null;
          
          return (
            <div
              key={i}
              className={cn(
                "flex-1 h-5 rounded-sm transition-all min-w-[3px] max-w-[12px]",
                hasHistoricalStatus && getStatusColor(historicalStatus),
                !hasHistoricalStatus && isPast && "bg-slate-700",
                !hasHistoricalStatus && isCurrent && getStatusColor(currentStatus),
                !hasHistoricalStatus && isFuture && "bg-slate-800",
                isCurrent && "ring-1 ring-white/30"
              )}
              title={isDaily ? `Day ${periodNumber}` : `Week ${periodNumber}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Steps Sidebar Component
 * Shows numbered steps with "See more" expandable details
 * Also shows traffic light rules at the bottom
 */
function StepsSidebar({ steps = [], trafficRules = {} }) {
  const [expandedSteps, setExpandedSteps] = useState([]);

  const toggleStep = (stepIndex) => {
    setExpandedSteps(prev => 
      prev.includes(stepIndex) 
        ? prev.filter(i => i !== stepIndex)
        : [...prev, stepIndex]
    );
  };

  if (!steps || steps.length === 0) return null;

  return (
    <div className="w-72 flex-shrink-0 border-r border-slate-800 pr-4 space-y-4">
      {/* Steps Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Steps
        </h3>
        {steps.map((step, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-medium">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm text-slate-300 leading-relaxed">
                  {step.title}
                </p>
                {step.details && (
                  <button
                    onClick={() => toggleStep(index)}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
                  >
                    {expandedSteps.includes(index) ? (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        <span>Hide details</span>
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-3 h-3" />
                        <span>See more</span>
                      </>
                    )}
                  </button>
                )}
                {expandedSteps.includes(index) && step.details && (
                  <div className="mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {step.details}
                    </p>
                    {step.link && (
                      <a
                        href={step.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open link
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Traffic Light Rules Section */}
      {trafficRules && Object.keys(trafficRules).length > 0 && (
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Status Rules
          </h3>
          <div className="space-y-2">
            {trafficRules.red && (
              <div className="flex items-start gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">{trafficRules.red}</p>
              </div>
            )}
            {trafficRules.yellow && (
              <div className="flex items-start gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500 mt-1 flex-shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">{trafficRules.yellow}</p>
              </div>
            )}
            {trafficRules.green && (
              <div className="flex items-start gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 mt-1 flex-shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">{trafficRules.green}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main Section Layout Component
 *
 * When `sectionId` is provided the component auto-fetches traffic light
 * history from the backend and passes it to TrafficLightHistory.
 * Externally-supplied `historyStatuses` (non-empty array) take priority
 * over the auto-fetched data, for backward compatibility.
 */
export default function SectionLayout({
  title,
  sectionId,
  subheadline,
  steps = [],
  trafficRules = {},
  isDaily = false,
  currentStatus = "gray",
  historyStatuses: externalHistoryStatuses = [],
  children,
  icon: Icon,
  inConstruction = false,
}) {
  const [fetchedHistory, setFetchedHistory] = useState([]);

  useEffect(() => {
    if (!sectionId || inConstruction) return;
    const param = isDaily ? "days=90" : "weeks=52";
    api
      .get(`/focus/traffic-light-history/${sectionId}?${param}`)
      .then((res) => {
        const raw = res.data?.history ?? [];
        // Map each entry: null/undefined status → keep as null (frontend renders gray)
        setFetchedHistory(raw.map((h) => h.status ?? null));
      })
      .catch(() => {
        // Silently fall back to empty (all gray) — no error toast
      });
  }, [sectionId, isDaily, inConstruction]);

  // External prop wins when non-empty (PersonalInvitationsPage legacy path)
  const historyStatuses =
    externalHistoryStatuses.length > 0 ? externalHistoryStatuses : fetchedHistory;

  return (
    <div className="space-y-6" data-testid={`section-${title?.toLowerCase().replace(/\s+/g, '-')}`}>
      {/* Header with Title */}
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="p-3 rounded-lg bg-[#ff3300]/20">
            <Icon className="w-6 h-6 text-[#ff3300]" />
          </div>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {inConstruction && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-xs font-medium">
              <Construction className="w-3.5 h-3.5" />
              In Construction
            </span>
          )}
        </div>
      </div>

      {/* Vision Statement */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700">
        <p className="text-sm text-slate-300 italic leading-relaxed">
          "{COMPANY_VISION}"
        </p>
      </div>

      {/* Section Subheadline - How this activity contributes to the vision */}
      {subheadline && (
        <div className="p-3 rounded-lg bg-slate-800/50 border-l-4 border-[#ff3300]">
          <p className="text-sm text-slate-400 leading-relaxed">
            {subheadline}
          </p>
        </div>
      )}

      {/* Traffic Light History - Full Width (hidden for in-construction sections) */}
      {!inConstruction && (
        <div className="w-full">
          <TrafficLightHistory 
            isDaily={isDaily} 
            currentStatus={currentStatus} 
            historyStatuses={historyStatuses}
          />
        </div>
      )}

      {/* Main Content Area with Sidebar */}
      <div className="flex gap-6">
        {/* Steps Sidebar */}
        <StepsSidebar steps={steps} trafficRules={trafficRules} />

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

export { COMPANY_VISION, TrafficLightHistory, StepsSidebar };
