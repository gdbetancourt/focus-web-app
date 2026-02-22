import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { MapPin, Globe, Target, TrendingUp } from "lucide-react";

export default function GEO() {
  return (
    <div className="space-y-6" data-testid="geo-page">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20">
          <MapPin className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            GEO - Generative Engine Optimization
            <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">Coming Soon</Badge>
          </h1>
          <p className="text-slate-500">Optimize your content for AI-powered search engines</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-6">
            <Globe className="w-8 h-8 text-green-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">AI Search Visibility</h3>
            <p className="text-sm text-slate-400">Optimize content for ChatGPT, Perplexity, and AI search engines.</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-6">
            <Target className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Entity Optimization</h3>
            <p className="text-sm text-slate-400">Build your brand's knowledge graph and entity recognition.</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-6">
            <TrendingUp className="w-8 h-8 text-teal-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Citation Tracking</h3>
            <p className="text-sm text-slate-400">Track how often AI systems cite your content.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
        <CardContent className="p-8 text-center">
          <MapPin className="w-12 h-12 mx-auto mb-4 text-green-400" />
          <h3 className="text-xl font-bold text-white mb-2">Feature Under Development</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Optimize your digital presence for the new era of AI-powered search and discovery.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
