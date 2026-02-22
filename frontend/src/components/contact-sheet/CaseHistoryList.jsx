/**
 * CaseHistoryList - Display contact's case associations
 */
import { Briefcase, Calendar, ArrowRight } from "lucide-react";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";

const STAGE_COLORS = {
  1: { bg: 'bg-slate-500/20', text: 'text-slate-400', name: 'Prospect' },
  2: { bg: 'bg-blue-500/20', text: 'text-blue-400', name: 'Nurture' },
  3: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', name: 'Close' },
  4: { bg: 'bg-green-500/20', text: 'text-green-400', name: 'Deliver' },
  5: { bg: 'bg-purple-500/20', text: 'text-purple-400', name: 'Repurchase' },
};

export function CaseHistoryList({ 
  cases = [], 
  loading = false,
  onCaseClick,
  onRoleChange 
}) {
  if (loading) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
        <p>Cargando casos...</p>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No hay casos asociados</p>
      </div>
    );
  }

  // Group by stage
  const byStage = cases.reduce((acc, c) => {
    const stage = c.stage || 1;
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Label className="text-slate-400 text-sm">
        Casos asociados ({cases.length})
      </Label>
      
      {Object.entries(byStage)
        .sort(([a], [b]) => Number(b) - Number(a)) // Sort by stage descending
        .map(([stage, stageCases]) => (
          <div key={stage} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={`text-xs ${STAGE_COLORS[stage]?.bg} ${STAGE_COLORS[stage]?.text}`}>
                Stage {stage}: {STAGE_COLORS[stage]?.name}
              </Badge>
              <span className="text-xs text-slate-500">({stageCases.length})</span>
            </div>
            
            {stageCases.map((caseItem, idx) => (
              <CaseCard 
                key={caseItem.case_id || caseItem.id || idx} 
                caseItem={caseItem}
                onClick={onCaseClick ? () => onCaseClick(caseItem) : undefined}
              />
            ))}
          </div>
        ))}
    </div>
  );
}

function CaseCard({ caseItem, onClick }) {
  const stage = caseItem.stage || 1;
  const stageConfig = STAGE_COLORS[stage] || STAGE_COLORS[1];
  
  return (
    <div 
      className={`p-3 rounded-lg border border-[#222] bg-[#1a1a1a] ${onClick ? 'cursor-pointer hover:border-[#333]' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">
            {caseItem.case_name || caseItem.name || 'Caso'}
          </p>
          
          {caseItem.company_name && (
            <p className="text-sm text-slate-400 truncate">
              {caseItem.company_name}
            </p>
          )}
          
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            {caseItem.role && (
              <Badge variant="outline" className="text-xs">
                {caseItem.role}
              </Badge>
            )}
            {caseItem.created_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(caseItem.created_at).toLocaleDateString('es-MX', {
                  day: 'numeric', month: 'short'
                })}
              </span>
            )}
          </div>
        </div>
        
        <div className={`p-2 rounded-lg ${stageConfig.bg}`}>
          <span className={`text-lg font-bold ${stageConfig.text}`}>
            {stage}
          </span>
        </div>
      </div>
    </div>
  );
}

export default CaseHistoryList;
