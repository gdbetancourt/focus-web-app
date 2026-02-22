/**
 * FocusNavigation - Flat navigation sidebar for Focus sections
 * 
 * Features:
 * - Flat list (no sub-elements)
 * - Traffic light indicator for each section (red, yellow, green)
 * - Construction indicator for sections in development
 * - Active section highlighting
 * - Assets sections in collapsible group
 * - Legacy sections collapsed at bottom
 */
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronDown, ChevronRight, FolderArchive, Construction, Package } from "lucide-react";
import { cn } from "../../lib/utils";
import FOCUS_SECTIONS from "./focusSections";
import ASSETS_SECTIONS from "./assetsSections";
import LEGACY_SECTIONS from "./legacySections";

/**
 * Traffic Light Indicator Component
 */
function TrafficLightIndicator({ status = "gray" }) {
  const colors = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
    gray: "bg-slate-600",
  };

  return (
    <span 
      className={cn(
        "w-2.5 h-2.5 rounded-full flex-shrink-0",
        colors[status] || colors.gray
      )}
      title={`Status: ${status}`}
    />
  );
}

/**
 * Construction Indicator Component
 */
function ConstructionIndicator() {
  return (
    <Construction 
      className="w-4 h-4 text-amber-500 flex-shrink-0" 
      title="In construction"
    />
  );
}

/**
 * Legacy Section Group Component
 */
function LegacySectionGroup({ group, items, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="font-medium">{group}</span>
      </button>
      
      {isOpen && (
        <div className="ml-2 space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path + item.label}
                to={item.path}
                onClick={() => onNavigate?.(item.path)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-all",
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                  )
                }
              >
                <Icon className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Main Navigation Component
 */
export default function FocusNavigation({ trafficLightStatus = {}, onNavigate }) {
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);

  return (
    <nav className="space-y-1">
      {/* Main Focus Sections */}
      {FOCUS_SECTIONS.map((section) => {
        const Icon = section.icon;
        const status = trafficLightStatus[section.id] || "gray";
        const isInConstruction = section.inConstruction === true;
        
        return (
          <NavLink
            key={section.id}
            to={section.path}
            onClick={() => onNavigate?.(section.id)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group",
                isActive
                  ? "bg-[#ff3300]/10 text-[#ff3300] border-l-2 border-[#ff3300]"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              )
            }
          >
            {isInConstruction ? (
              <ConstructionIndicator />
            ) : (
              <TrafficLightIndicator status={status} />
            )}
            <span className="font-medium text-sm truncate">{section.label}</span>
          </NavLink>
        );
      })}

      {/* Separator */}
      <div className="my-4 border-t border-slate-800" />

      {/* Assets Sections - Collapsible */}
      <div className="space-y-1">
        <button
          onClick={() => setAssetsOpen(!assetsOpen)}
          className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          {assetsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Package className="w-4 h-4" />
          <span className="text-sm font-medium">Assets</span>
        </button>

        {assetsOpen && (
          <div className="ml-2 space-y-0.5 pb-2">
            {ASSETS_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isInConstruction = section.inConstruction === true;
              
              return (
                <NavLink
                  key={section.id}
                  to={section.path}
                  onClick={() => onNavigate?.(section.id)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all",
                      isActive
                        ? "bg-[#ff3300]/10 text-[#ff3300]"
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                    )
                  }
                >
                  {isInConstruction ? (
                    <Construction className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <span className="truncate">{section.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="my-4 border-t border-slate-800" />

      {/* Legacy Sections */}
      <div className="space-y-2">
        <button
          onClick={() => setLegacyOpen(!legacyOpen)}
          className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {legacyOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <FolderArchive className="w-4 h-4" />
          <span className="text-sm font-medium">Legacy Sections</span>
        </button>

        {legacyOpen && (
          <div className="ml-2 space-y-2 pb-4">
            {LEGACY_SECTIONS.map((group) => (
              <LegacySectionGroup
                key={group.group}
                group={group.group}
                items={group.items}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

export { TrafficLightIndicator };
