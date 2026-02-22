import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Youtube, Search, TrendingUp, Eye } from "lucide-react";

export default function LongFormVideoSearch() {
  return (
    <div className="space-y-6" data-testid="long-form-search-page">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20">
          <Youtube className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Long Form Video Search
            <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">Coming Soon</Badge>
          </h1>
          <p className="text-slate-500">Find trending long-form videos and content ideas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-6">
            <Search className="w-8 h-8 text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">YouTube Search</h3>
            <p className="text-sm text-slate-400">Search and analyze trending YouTube videos in your industry.</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-6">
            <TrendingUp className="w-8 h-8 text-orange-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Trend Analysis</h3>
            <p className="text-sm text-slate-400">Identify content trends and opportunities for your channel.</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-6">
            <Eye className="w-8 h-8 text-yellow-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Competitor Watch</h3>
            <p className="text-sm text-slate-400">Monitor competitor channels and their top-performing content.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/20">
        <CardContent className="p-8 text-center">
          <Youtube className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h3 className="text-xl font-bold text-white mb-2">Feature Under Development</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Search and analyze YouTube videos to find content ideas and trending topics in your niche.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
