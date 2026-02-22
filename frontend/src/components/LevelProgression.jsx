import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, 
  Star, 
  Zap, 
  Target, 
  Award,
  TrendingUp,
  CheckCircle,
  Lock
} from "lucide-react";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";

// Level definitions with requirements and rewards
const LEVELS = [
  {
    level: 1,
    name: "Starter",
    icon: Star,
    color: "text-slate-400",
    bgColor: "bg-slate-500/20",
    borderColor: "border-slate-500/30",
    requirement: 0,
    description: "Getting started with Leaderlix"
  },
  {
    level: 2,
    name: "Explorer",
    icon: Target,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/30",
    requirement: 50,
    description: "Added first 50 contacts"
  },
  {
    level: 3,
    name: "Builder",
    icon: Zap,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    borderColor: "border-purple-500/30",
    requirement: 100,
    description: "Growing your pipeline"
  },
  {
    level: 4,
    name: "Achiever",
    icon: Award,
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    borderColor: "border-orange-500/30",
    requirement: 250,
    description: "Scaling your outreach"
  },
  {
    level: 5,
    name: "Champion",
    icon: Trophy,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    borderColor: "border-yellow-500/30",
    requirement: 500,
    description: "Sales pipeline master"
  }
];

// Calculate current level based on contacts
const calculateLevel = (contacts) => {
  let currentLevel = LEVELS[0];
  for (const level of LEVELS) {
    if (contacts >= level.requirement) {
      currentLevel = level;
    } else {
      break;
    }
  }
  return currentLevel;
};

// Calculate progress to next level
const calculateProgress = (contacts) => {
  const currentLevel = calculateLevel(contacts);
  const currentLevelIndex = LEVELS.findIndex(l => l.level === currentLevel.level);
  const nextLevel = LEVELS[currentLevelIndex + 1];
  
  if (!nextLevel) {
    return { progress: 100, remaining: 0, nextLevel: null };
  }
  
  const levelStart = currentLevel.requirement;
  const levelEnd = nextLevel.requirement;
  const progressInLevel = contacts - levelStart;
  const levelRange = levelEnd - levelStart;
  const progress = Math.min((progressInLevel / levelRange) * 100, 100);
  
  return {
    progress: Math.round(progress),
    remaining: levelEnd - contacts,
    nextLevel
  };
};

// Animated number counter
const AnimatedCounter = ({ value, duration = 1000 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let startTime;
    let animationFrame;
    
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(easeOut * value));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);
  
  return <span>{displayValue.toLocaleString()}</span>;
};

// Main Level Progression Component
export const LevelProgression = ({ 
  totalContacts = 0, 
  className = "",
  showDetails = true,
  compact = false
}) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const currentLevel = calculateLevel(totalContacts);
  const { progress, remaining, nextLevel } = calculateProgress(totalContacts);
  const LevelIcon = currentLevel.icon;
  
  useEffect(() => {
    // Trigger animation on mount
    const timer = setTimeout(() => setIsAnimating(false), 2000);
    return () => clearTimeout(timer);
  }, []);
  
  if (compact) {
    return (
      <motion.div 
        className={`flex items-center gap-3 ${className}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className={`p-2 rounded-lg ${currentLevel.bgColor}`}>
          <LevelIcon className={`w-5 h-5 ${currentLevel.color}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white">
              Level {currentLevel.level} - {currentLevel.name}
            </span>
            <span className="text-xs text-slate-400">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </motion.div>
    );
  }
  
  return (
    <motion.div 
      className={`bg-[#111] border border-[#222] rounded-xl p-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#ff3300]" />
          Level Progression
        </h3>
        <Badge 
          variant="outline" 
          className={`${currentLevel.borderColor} ${currentLevel.color}`}
        >
          Level {currentLevel.level}
        </Badge>
      </div>
      
      {/* Current Level Display */}
      <div className="flex items-center gap-4 mb-6">
        <motion.div 
          className={`p-4 rounded-xl ${currentLevel.bgColor} border ${currentLevel.borderColor}`}
          animate={isAnimating ? { 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <LevelIcon className={`w-8 h-8 ${currentLevel.color}`} />
        </motion.div>
        <div>
          <h4 className={`text-xl font-bold ${currentLevel.color}`}>
            {currentLevel.name}
          </h4>
          <p className="text-sm text-slate-400">{currentLevel.description}</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold text-white">
            <AnimatedCounter value={totalContacts} />
          </div>
          <div className="text-sm text-slate-500">contacts</div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-slate-400">
            Progress to {nextLevel ? nextLevel.name : "Max Level"}
          </span>
          <span className="text-sm font-medium text-white">{progress}%</span>
        </div>
        <div className="relative">
          <Progress 
            value={0} 
            className="h-3 bg-[#222]" 
          />
          <motion.div
            className="absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r from-[#ff3000] to-[#f9a11d]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
          />
        </div>
        {nextLevel && (
          <p className="text-xs text-slate-500 mt-2">
            {remaining} more contacts to reach <span className={nextLevel.color}>{nextLevel.name}</span>
          </p>
        )}
      </div>
      
      {/* Level Roadmap */}
      {showDetails && (
        <div className="grid grid-cols-5 gap-2">
          {LEVELS.map((level, index) => {
            const isCompleted = totalContacts >= level.requirement;
            const isCurrent = level.level === currentLevel.level;
            const Icon = level.icon;
            
            return (
              <motion.div
                key={level.level}
                className={`relative p-3 rounded-lg text-center transition-all ${
                  isCompleted 
                    ? `${level.bgColor} border ${level.borderColor}` 
                    : 'bg-[#0a0a0a] border border-[#333] opacity-50'
                } ${isCurrent ? 'ring-2 ring-[#ff3300] ring-offset-2 ring-offset-[#111]' : ''}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 + 0.5 }}
                whileHover={{ scale: 1.05 }}
              >
                <Icon className={`w-5 h-5 mx-auto mb-1 ${isCompleted ? level.color : 'text-slate-600'}`} />
                <p className={`text-xs font-medium ${isCompleted ? 'text-white' : 'text-slate-600'}`}>
                  {level.name}
                </p>
                <p className={`text-[10px] ${isCompleted ? 'text-slate-400' : 'text-slate-600'}`}>
                  {level.requirement}+
                </p>
                {isCompleted && (
                  <CheckCircle className="absolute -top-1 -right-1 w-4 h-4 text-green-400" />
                )}
                {!isCompleted && (
                  <Lock className="absolute -top-1 -right-1 w-3 h-3 text-slate-600" />
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

// Mini version for sidebar or compact spaces
export const LevelProgressionMini = ({ totalContacts = 0 }) => {
  const currentLevel = calculateLevel(totalContacts);
  const { progress } = calculateProgress(totalContacts);
  const LevelIcon = currentLevel.icon;
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0a] rounded-lg">
      <LevelIcon className={`w-4 h-4 ${currentLevel.color}`} />
      <div className="flex-1">
        <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#ff3000] to-[#f9a11d]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>
      <span className="text-xs text-slate-400">Lv.{currentLevel.level}</span>
    </div>
  );
};

export default LevelProgression;
