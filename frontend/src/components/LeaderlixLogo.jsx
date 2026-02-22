import React from 'react';

// Leaderlix Logo Component with advanced animation support
// Derived from official brand assets

export const LeaderlixIsotipo = ({ 
  className = "", 
  animate = false,
  animationType = "pulse", // "pulse" | "glow" | "draw" | "bounce" | "spin"
  variant = "gradient" // "gradient" | "white" | "dark"
}) => {
  const gradientId = `leaderlix-gradient-${Math.random().toString(36).substr(2, 9)}`;
  const glowId = `leaderlix-glow-${Math.random().toString(36).substr(2, 9)}`;
  
  const getAnimationClass = () => {
    if (!animate) return '';
    switch (animationType) {
      case 'pulse': return 'leaderlix-pulse';
      case 'glow': return 'leaderlix-glow';
      case 'draw': return 'leaderlix-draw';
      case 'bounce': return 'leaderlix-bounce';
      case 'spin': return 'leaderlix-spin';
      default: return 'leaderlix-pulse';
    }
  };
  
  return (
    <svg 
      viewBox="0 0 65 78" 
      className={`${className} ${getAnimationClass()}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff3000">
            {animate && animationType === 'glow' && (
              <animate 
                attributeName="stop-color" 
                values="#ff3000;#ff6000;#ff3000" 
                dur="2s" 
                repeatCount="indefinite"
              />
            )}
          </stop>
          <stop offset="100%" stopColor="#f9a11d">
            {animate && animationType === 'glow' && (
              <animate 
                attributeName="stop-color" 
                values="#f9a11d;#ffcc00;#f9a11d" 
                dur="2s" 
                repeatCount="indefinite"
              />
            )}
          </stop>
        </linearGradient>
        {animate && animationType === 'glow' && (
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        )}
      </defs>
      <path 
        fill={variant === "white" ? "#ffffff" : variant === "dark" ? "#111111" : `url(#${gradientId})`}
        filter={animate && animationType === 'glow' ? `url(#${glowId})` : undefined}
        className={animate && animationType === 'draw' ? 'leaderlix-path-draw' : ''}
        d="M13.71,51.54c-1.69-1.17-3.38-2.34-5.07-3.51-.81-.56-1.61-1.13-2.43-1.68-.05-.03-.09-.07-.14-.1-.1-.06-3.9-3.48.35.26-.32-.28.14-.05.12.22,0-.03-.22-.34-.2-.32.12.08.19.68.11.24-.11-.64-.02.77,0,.08,0-.03,0-.07,0-.1-.03-3.41,0-6.82,0-10.22V12.66c0-.1,0-.21,0-.31,0-.07.02-.14,0-.2.02.08-.2.81-.04.36.02-.07.1-.26.1-.31s-.28.72-.16.41c.2-.47-.02.1-.19.2.05-.03.17-.17.21-.22.3-.34-.22.2-.29.22.06-.01.23-.13.26-.16.28-.18.2.14-.35.14.05,0,.28-.11.3-.08.04.06-.8.03-.47.06.1,0,.22,0,.31,0,.35-.04-.8-.21-.31-.04.05.02.24.09.31.1-.1,0-.69-.39-.31-.1.05.04.1.07.15.1.03.02.05.04.08.05.37.25.73.5,1.1.75l4.96,3.39c4.4,3.01,8.8,6.02,13.21,9.03,1.21.83,2.42,1.66,3.63,2.49,2.19,1.48,4.91,1.28,7.04-.17,3.54-2.42,7.09-4.83,10.63-7.25,3.83-2.61,7.65-5.22,11.48-7.82.3-.2.6-.42.9-.61.08-.05.29-.13.32-.19-.02.03-.66.2-.39.16.1-.01.22-.05.31-.09.36-.13-.75-.02-.39.06.08.02.33-.05.39.01.01.01-.91-.14-.4-.03.29.06.21.24-.34-.17.11.08.66.45.2.07-.63-.51.47.6-.03-.03-.32-.4-.13-.17-.07-.07.27.48-.17-.74-.07-.19.01.07.05.27.08.32-.01-.02-.03-.73-.07-.43,0,.04,0,.07,0,.11,0,.07,0,.15,0,.22,0,.31,0,.63,0,.94v11.1c0,.33,0,.65,0,.98,0,.07,0,.14,0,.21.02.61.12-.67-.02.03-.08.39.34-.56.1-.25-.07.1-.29.48-.02.06.24-.36.09-.13,0-.04,13.43-12,.46-.33.35-.26-.01,0-.02.02-.04.02-.07.05-.15.1-.22.15-2.45,1.72-4.9,3.44-7.36,5.16-4.36,3.06-8.72,6.11-13.08,9.17-4.26,2.98-8.51,5.97-12.77,8.95-2.14,1.5-4.3,2.98-6.43,4.51-1.67,1.19-2.75,2.83-2.84,4.93-.07,1.57.55,3.09,1.58,4.25.39.43.87.76,1.34,1.1,1.78,1.3,3.57,2.58,5.35,3.87,1.58,1.14,3.13,2.33,4.74,3.43,1.9,1.31,4.63,1.29,6.55.02.27-.18.54-.38.8-.57,3.57-2.51,7.13-5.02,10.7-7.53l12.37-8.7c.84-.59,1.69-1.18,2.53-1.78,1.77-1.28,2.79-3.03,2.8-5.24,0-.97,0-1.93,0-2.9v-5.95c0-1.69-1.48-3.3-3.22-3.22s-3.22,1.42-3.22,3.22v6.27c0,.89-.02,1.79,0,2.68,0,.02,0,.04,0,.06.02.57.16-.52.03-.18-.26.67.25-.49,0,.02-.22.45.1-.13.16-.2-.34.38.14-.08.22-.13-.06.03-.11.08-.16.11-3.04,2.11-6.05,4.25-9.07,6.38-4.36,3.07-8.73,6.14-13.09,9.21-1.24.87-2.48,1.74-3.71,2.61-.12.08-.23.16-.35.24-.02.01-.04.03-.06.05-.03.02-.06.04-.1.06-.11.07-.52.28-.07.07.51-.24-.16,0-.19.01.08-.04.79-.05.26-.08.13,0,.72.22.26.02-.51-.22.6.38-.07-.05-.06-.04-.12-.08-.18-.13-.23-.16-.46-.33-.69-.5-2.04-1.48-4.08-2.95-6.12-4.43l-2.69-1.95c-.21-.15-.41-.3-.62-.45-.25-.18.29.15.31.23,0-.03-.25-.25-.24-.25.03.01.5.66.22.24-.06-.09-.19-.39.02.09.23.52.05.05.01-.08-.17-.52.1.41.05.38.02.01-.03-.3,0-.32.05-.04-.23.9-.04.38.02-.07.1-.26.09-.31,0,.04-.36.76-.12.33.06-.1.24-.33-.06.05-.32.41-.08.09.03,0,.31-.26-.65.43-.31.22.04-.02.08-.05.11-.08.27-.18.53-.37.79-.56,1.16-.81,2.32-1.63,3.48-2.44,3.99-2.8,7.99-5.6,11.98-8.4,4.52-3.17,9.04-6.34,13.56-9.51,3.01-2.11,6.02-4.22,9.04-6.34.28-.2.56-.39.84-.59,1.26-.9,2.2-1.96,2.68-3.46.29-.91.25-1.87.25-2.81v-11.1c0-.86.01-1.65-.14-2.51-.48-2.79-3.19-4.87-5.99-4.81-1.95.04-3.29,1.07-4.8,2.09l-5.39,3.67c-4.38,2.98-8.75,5.96-13.13,8.95-1.06.72-2.11,1.46-3.18,2.17-.03.02-.05.04-.08.05-.03.02-.06.04-.1.06l-.09.06c-.25.13-.25.13,0,.01.26-.1.25-.12-.01-.03l.45-.05s-.41,0-.41,0c.04-.08.81.21.25,0,.09.03.64.37.19.07-.05-.03-.13-.08-.18-.11-.02-.01-.04-.03-.06-.04-.35-.23-.68-.47-1.03-.7-3.91-2.67-7.82-5.35-11.72-8.02-3.38-2.32-6.76-4.64-10.15-6.95-1.05-.71-2.34-1.15-3.62-1.07C2.61,6.5.14,9.02.02,12.24c-.03.85,0,1.7,0,2.55v29.18c0,.92-.03,1.84,0,2.75.06,2.27,1.2,3.97,3.02,5.24.85.6,1.71,1.19,2.57,1.78,1.62,1.12,3.24,2.24,4.86,3.37,1.39.96,3.64.3,4.41-1.16.87-1.64.33-3.38-1.16-4.41h0Z"
      />
      <style>{`
        /* Pulse animation - subtle scale */
        @keyframes leaderlix-pulse-anim {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.03); }
        }
        .leaderlix-pulse {
          animation: leaderlix-pulse-anim 2s ease-in-out infinite;
          transform-origin: center;
        }
        
        /* Glow animation - handled by SVG filter + gradient animation */
        .leaderlix-glow {
          filter: drop-shadow(0 0 8px rgba(255, 48, 0, 0.6));
          animation: leaderlix-glow-anim 2s ease-in-out infinite;
        }
        @keyframes leaderlix-glow-anim {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(255, 48, 0, 0.6)); }
          50% { filter: drop-shadow(0 0 16px rgba(249, 161, 29, 0.8)); }
        }
        
        /* Draw animation - stroke effect */
        .leaderlix-draw path, .leaderlix-path-draw {
          stroke: #ff3000;
          stroke-width: 1;
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: leaderlix-draw-anim 3s ease forwards;
        }
        @keyframes leaderlix-draw-anim {
          to { stroke-dashoffset: 0; }
        }
        
        /* Bounce animation */
        @keyframes leaderlix-bounce-anim {
          0%, 100% { transform: translateY(0); }
          25% { transform: translateY(-4px); }
          75% { transform: translateY(2px); }
        }
        .leaderlix-bounce {
          animation: leaderlix-bounce-anim 1.5s ease-in-out infinite;
        }
        
        /* Spin animation */
        @keyframes leaderlix-spin-anim {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .leaderlix-spin {
          animation: leaderlix-spin-anim 4s linear infinite;
          transform-origin: center;
        }
        
        /* Respect reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .leaderlix-pulse,
          .leaderlix-glow,
          .leaderlix-draw,
          .leaderlix-bounce,
          .leaderlix-spin {
            animation: none;
          }
        }
      `}</style>
    </svg>
  );
};

export const LeaderlixLogo = ({ 
  className = "", 
  variant = "gradient", // "gradient" | "white" | "dark"
  showText = true,
  animate = false,
  animationType = "pulse"
}) => {
  const textColor = variant === "white" ? "#ffffff" : variant === "dark" ? "#111111" : "#ffffff";
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LeaderlixIsotipo 
        className="w-8 h-8" 
        variant={variant} 
        animate={animate}
        animationType={animationType}
      />
      {showText && (
        <span 
          className={`text-xl font-bold tracking-tight ${animate ? 'animate-fade-in' : ''}`}
          style={{ 
            fontFamily: "'Comfortaa', sans-serif",
            color: textColor 
          }}
        >
          leaderlix
        </span>
      )}
    </div>
  );
};

// Animated logo for loading states
export const LeaderlixLogoLoader = ({ size = "md" }) => {
  const sizeClasses = {
    sm: "w-8 h-10",
    md: "w-12 h-14",
    lg: "w-16 h-20",
    xl: "w-24 h-28"
  };
  
  return (
    <div className="flex flex-col items-center gap-3">
      <LeaderlixIsotipo 
        className={sizeClasses[size]} 
        animate={true} 
        animationType="glow" 
      />
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div 
            key={i}
            className="w-2 h-2 rounded-full bg-gradient-to-r from-[#ff3000] to-[#f9a11d]"
            style={{
              animation: `leaderlix-dot-bounce 1.4s ease-in-out ${i * 0.16}s infinite`
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes leaderlix-dot-bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LeaderlixLogo;
