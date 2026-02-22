import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Search, FileText, Link, BarChart } from "lucide-react";

export default function SEO() {
  return (
    <div className="space-y-6" data-testid="seo-page">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
          <Search className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            SEO - Search Engine Optimization
            <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">Coming Soon</Badge>
          </h1>
          <p className="text-slate-500">Improve your search engine rankings and organic traffic</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-6">
            <FileText className="w-8 h-8 text-blue-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Keyword Research</h3>
            <p className="text-sm text-slate-400">Find high-value keywords and content opportunities.</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-6">
            <Link className="w-8 h-8 text-cyan-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Backlink Analysis</h3>
            <p className="text-sm text-slate-400">Monitor and build quality backlinks to your site.</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-6">
            <BarChart className="w-8 h-8 text-indigo-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Rank Tracking</h3>
            <p className="text-sm text-slate-400">Track your positions for target keywords over time.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/20">
        <CardContent className="p-8 text-center">
          <Search className="w-12 h-12 mx-auto mb-4 text-blue-400" />
          <h3 className="text-xl font-bold text-white mb-2">Feature Under Development</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Comprehensive SEO tools to improve your website's visibility in search engines.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
