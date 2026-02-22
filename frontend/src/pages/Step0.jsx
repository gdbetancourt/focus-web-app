import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { BookOpen, Check, AlertCircle } from "lucide-react";

// Bible passages related to work, leadership, generosity, empathy
const BIBLE_PASSAGES = [
  {
    reference: "Colossians 3:23-24",
    text: "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters, since you know that you will receive an inheritance from the Lord as a reward. It is the Lord Christ you are serving."
  },
  {
    reference: "Proverbs 16:3",
    text: "Commit to the Lord whatever you do, and he will establish your plans."
  },
  {
    reference: "Proverbs 12:24",
    text: "Diligent hands will rule, but laziness ends in forced labor."
  },
  {
    reference: "Ecclesiastes 9:10",
    text: "Whatever your hand finds to do, do it with all your might, for in the realm of the dead, where you are going, there is neither working nor planning nor knowledge nor wisdom."
  },
  {
    reference: "Matthew 20:26-28",
    text: "Not so with you. Instead, whoever wants to become great among you must be your servant, and whoever wants to be first must be your slave— just as the Son of Man did not come to be served, but to serve, and to give his life as a ransom for many."
  },
  {
    reference: "Proverbs 11:25",
    text: "A generous person will prosper; whoever refreshes others will be refreshed."
  },
  {
    reference: "Luke 6:38",
    text: "Give, and it will be given to you. A good measure, pressed down, shaken together and running over, will be poured into your lap. For with the measure you use, it will be measured to you."
  },
  {
    reference: "Philippians 2:3-4",
    text: "Do nothing out of selfish ambition or vain conceit. Rather, in humility value others above yourselves, not looking to your own interests but each of you to the interests of the others."
  },
  {
    reference: "Galatians 6:9",
    text: "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up."
  },
  {
    reference: "1 Peter 4:10",
    text: "Each of you should use whatever gift you have received to serve others, as faithful stewards of God's grace in its various forms."
  },
  {
    reference: "Proverbs 22:29",
    text: "Do you see someone skilled in their work? They will serve before kings; they will not serve before officials of low rank."
  },
  {
    reference: "Romans 12:11",
    text: "Never be lacking in zeal, but keep your spiritual fervor, serving the Lord."
  },
  {
    reference: "2 Timothy 2:15",
    text: "Do your best to present yourself to God as one approved, a worker who does not need to be ashamed and who correctly handles the word of truth."
  },
  {
    reference: "Proverbs 14:23",
    text: "All hard work brings a profit, but mere talk leads only to poverty."
  },
  {
    reference: "James 1:22",
    text: "Do not merely listen to the word, and so deceive yourselves. Do what it says."
  },
  {
    reference: "Ephesians 4:32",
    text: "Be kind and compassionate to one another, forgiving each other, just as in Christ God forgave you."
  },
  {
    reference: "1 Corinthians 15:58",
    text: "Therefore, my dear brothers and sisters, stand firm. Let nothing move you. Always give yourselves fully to the work of the Lord, because you know that your labor in the Lord is not in vain."
  },
  {
    reference: "Proverbs 3:27",
    text: "Do not withhold good from those to whom it is due, when it is in your power to act."
  },
  {
    reference: "Matthew 25:21",
    text: "His master replied, 'Well done, good and faithful servant! You have been faithful with a few things; I will put you in charge of many things. Come and share your master's happiness!'"
  },
  {
    reference: "Isaiah 40:31",
    text: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint."
  }
];

const INACTIVITY_THRESHOLD = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

export default function Step0({ onUnlock }) {
  const [passage, setPassage] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Select random passage based on day of year for consistency
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const randomIndex = dayOfYear % BIBLE_PASSAGES.length;
    setPassage(BIBLE_PASSAGES[randomIndex]);
  }, []);

  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const checkPassage = () => {
    if (!passage) return;
    
    const normalizedInput = normalizeText(userInput);
    const normalizedPassage = normalizeText(passage.text);
    
    // Allow for some flexibility (90% match)
    const inputWords = normalizedInput.split(' ');
    const passageWords = normalizedPassage.split(' ');
    
    let matchCount = 0;
    inputWords.forEach((word, i) => {
      if (passageWords[i] === word) matchCount++;
    });
    
    const accuracy = matchCount / passageWords.length;
    
    if (accuracy >= 0.85) {
      setIsCorrect(true);
      setError(false);
      // Store unlock time
      localStorage.setItem('focus_last_activity', Date.now().toString());
      setTimeout(() => {
        onUnlock();
      }, 1500);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  if (!passage) return null;

  return (
    <div className="bible-overlay animate-fade-in">
      <div className="bible-card">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <BookOpen className="w-8 h-8 text-[#ff3300]" />
          <h1 className="text-3xl font-black text-white">Step 0</h1>
        </div>
        
        {/* Subtitle */}
        <p className="text-center text-slate-400 mb-8">
          Before you begin, center yourself with God's word.
          <br />
          <span className="text-sm">Type the passage below to unlock Focus.</span>
        </p>
        
        {/* Bible Passage Display */}
        <div className="bg-slate-900/50 rounded-xl p-6 mb-8 border border-slate-700">
          <p className="text-[#ff3300] font-semibold mb-3 text-sm tracking-wider">
            {passage.reference}
          </p>
          <p className="text-white text-xl leading-relaxed font-light">
            "{passage.text}"
          </p>
        </div>
        
        {/* Input Area */}
        <div className="space-y-4">
          <label className="block text-slate-400 text-sm font-medium">
            Type the passage here:
          </label>
          <Textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Begin typing the passage..."
            className={`min-h-[150px] bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-300 focus:border-[#ff3300] focus:ring-[#ff3300]/20 ${
              error ? 'border-red-500 animate-shake' : ''
            } ${isCorrect ? 'border-green-500' : ''}`}
            disabled={isCorrect}
          />
        </div>
        
        {/* Submit Button */}
        <div className="mt-6 flex justify-center">
          {isCorrect ? (
            <div className="flex items-center gap-2 text-green-400">
              <Check className="w-6 h-6" />
              <span className="font-semibold">Passage verified. Unlocking Focus...</span>
            </div>
          ) : (
            <Button
              onClick={checkPassage}
              disabled={!userInput.trim()}
              className="btn-primary px-8 py-3 text-lg"
            >
              Verify & Unlock
            </Button>
          )}
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mt-4 flex items-center justify-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>Please check your input and try again.</span>
          </div>
        )}
        
        {/* Footer */}
        <p className="text-center text-slate-300 text-xs mt-8">
          Focus · Step 0 appears after 4 hours of inactivity
        </p>
      </div>
    </div>
  );
}

// Hook to check if Step0 should be shown
export function useStep0() {
  const [showStep0, setShowStep0] = useState(false);
  
  useEffect(() => {
    const checkInactivity = () => {
      const lastActivity = localStorage.getItem('focus_last_activity');
      if (!lastActivity) {
        // First time user
        localStorage.setItem('focus_last_activity', Date.now().toString());
        return false;
      }
      
      const timeSinceActivity = Date.now() - parseInt(lastActivity);
      return timeSinceActivity >= INACTIVITY_THRESHOLD;
    };
    
    setShowStep0(checkInactivity());
  }, []);
  
  const updateActivity = () => {
    localStorage.setItem('focus_last_activity', Date.now().toString());
  };
  
  const unlock = () => {
    setShowStep0(false);
    updateActivity();
  };
  
  return { showStep0, unlock, updateActivity };
}
