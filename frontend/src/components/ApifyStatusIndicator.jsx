import React, { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Activity, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../lib/api';

/**
 * ApifyStatusIndicator - Shows Apify account status and credits
 * Use this in scraping modules (1.1.1.x, 1.1.2)
 */
export default function ApifyStatusIndicator({ compact = false }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await api.get('/scrappers/apify/status');
      setStatus(res.data);
    } catch (error) {
      console.error('Error loading Apify status:', error);
      setStatus({ success: false, error: 'Failed to load' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Badge variant="outline" className="border-slate-500/30 text-slate-400">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        {!compact && 'Apify...'}
      </Badge>
    );
  }

  if (!status?.success) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="border-red-500/30 text-red-400">
              <XCircle className="w-3 h-3 mr-1" />
              {!compact && 'Error'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Error connecting to Apify</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const isLimitExceeded = status.status === 'limit_exceeded';
  const remainingCredits = status.credits?.remaining_usd || 0;
  const isLow = remainingCredits < 5;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge 
            variant="outline" 
            className={
              isLimitExceeded 
                ? "border-red-500/30 text-red-400 bg-red-500/10" 
                : isLow 
                  ? "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
                  : "border-green-500/30 text-green-400 bg-green-500/10"
            }
          >
            {isLimitExceeded ? (
              <AlertTriangle className="w-3 h-3 mr-1" />
            ) : isLow ? (
              <Activity className="w-3 h-3 mr-1" />
            ) : (
              <CheckCircle className="w-3 h-3 mr-1" />
            )}
            {!compact && (
              <>
                Apify: ${remainingCredits.toFixed(2)}
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="bg-[#1a1a1a] border-[#333] p-3">
          <div className="space-y-2 text-sm">
            <p className="font-medium text-white">Apify Status</p>
            <div className="grid grid-cols-2 gap-2 text-slate-400">
              <span>Plan:</span>
              <span className="text-white">{status.plan_name}</span>
              <span>Remaining credits:</span>
              <span className={isLow ? "text-yellow-400" : "text-green-400"}>
                ${remainingCredits.toFixed(2)} USD
              </span>
              <span>Monthly usage:</span>
              <span className="text-white">${status.credits?.monthly_usage_usd?.toFixed(2) || '0.00'}</span>
              <span>Limit:</span>
              <span className="text-white">${status.credits?.limit_usd?.toFixed(2) || '0.00'}</span>
            </div>
            {isLimitExceeded && (
              <p className="text-red-400 text-xs mt-2">
                ⚠️ Credit limit reached
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
