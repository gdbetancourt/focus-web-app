import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Newspaper, Radio, Tv, Mic, Users } from "lucide-react";

export default function Media() {
  return (
    <div className="space-y-6" data-testid="media-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
          <Newspaper className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Media
            <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">Coming Soon</Badge>
          </h1>
          <p className="text-slate-500">Manage media relations and press coverage</p>
        </div>
      </div>

      {/* Features Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[#111] border-[#222] hover:border-purple-500/30 transition-colors">
          <CardContent className="p-6">
            <Newspaper className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Press Releases</h3>
            <p className="text-sm text-slate-400">
              Create and distribute press releases to media contacts.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-[#222] hover:border-pink-500/30 transition-colors">
          <CardContent className="p-6">
            <Users className="w-8 h-8 text-pink-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Media Contacts</h3>
            <p className="text-sm text-slate-400">
              Build and manage relationships with journalists and influencers.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-[#222] hover:border-blue-500/30 transition-colors">
          <CardContent className="p-6">
            <Radio className="w-8 h-8 text-blue-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Podcasts</h3>
            <p className="text-sm text-slate-400">
              Track podcast appearances and guest opportunities.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-[#222] hover:border-cyan-500/30 transition-colors">
          <CardContent className="p-6">
            <Tv className="w-8 h-8 text-cyan-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">TV & Interviews</h3>
            <p className="text-sm text-slate-400">
              Schedule and prepare for media interviews.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder Message */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
        <CardContent className="p-8 text-center">
          <Mic className="w-12 h-12 mx-auto mb-4 text-purple-400" />
          <h3 className="text-xl font-bold text-white mb-2">Feature Under Development</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            We're building a comprehensive media relations management system 
            to help you get more press coverage and build your public presence.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
