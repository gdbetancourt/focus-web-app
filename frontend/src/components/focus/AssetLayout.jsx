/**
 * AssetLayout - Simple layout for Asset pages
 * 
 * Unlike SectionLayout, this doesn't include:
 * - Vision statement
 * - Steps sidebar
 * - Traffic light history
 * 
 * Just a clean header with the asset name and icon.
 */
import { Construction } from "lucide-react";

export default function AssetLayout({
  title,
  children,
  icon: Icon,
  inConstruction = false,
}) {
  return (
    <div className="space-y-6" data-testid={`asset-${title?.toLowerCase().replace(/\s+/g, '-')}`}>
      {/* Header */}
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="p-3 rounded-lg bg-slate-800">
            <Icon className="w-6 h-6 text-slate-300" />
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

      {/* Content */}
      <div className="min-w-0">
        {children}
      </div>
    </div>
  );
}
