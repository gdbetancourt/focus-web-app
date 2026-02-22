import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { 
  Building2, 
  Calculator, 
  Check, 
  X, 
  Download, 
  Mail,
  Loader2,
  GraduationCap,
  DollarSign,
  Users,
  Minus,
  Plus
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import api from "../lib/api";

// PDF generation using html2pdf
const generatePDF = async (quote, eventName, benefits, level) => {
  const { default: html2pdf } = await import("html2pdf.js");
  
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value) => `${(value * 100).toFixed(0)}%`;
  
  const levelBenefits = benefits.filter(b => b[level] === true);
  
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
      <div style="border-bottom: 3px solid #ff3300; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="color: #333; margin: 0; font-size: 28px;">Sponsorship Quote</h1>
        <p style="color: #666; margin: 10px 0 0 0;">${eventName}</p>
      </div>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 30px;">
        <table style="width: 100%;">
          <tr>
            <td style="color: #666;">Quote ID:</td>
            <td style="font-weight: bold; text-align: right;">${quote.quote_id}</td>
          </tr>
          <tr>
            <td style="color: #666;">Date:</td>
            <td style="text-align: right;">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</td>
          </tr>
          <tr>
            <td style="color: #666;">Sponsorship Level:</td>
            <td style="text-align: right;"><span style="background: #ff3300; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${quote.calculation.level_name}</span></td>
          </tr>
        </table>
      </div>
      
      <h2 style="color: #333; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Scholarship Investment</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Unit Price</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Discount</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">Coaching Scholarships</td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">${quote.calculation.coaching.quantity}</td>
            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;">${formatCurrency(quote.calculation.coaching.unit_price)}</td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee; color: #22c55e;">${formatPercent(quote.calculation.coaching.discount_percent)}</td>
            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; font-weight: bold;">${formatCurrency(quote.calculation.coaching.subtotal)}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Scholarship Total:</td>
            <td style="padding: 8px 0; text-align: right;">${formatCurrency(quote.calculation.scholarship_total)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Sponsorship Fee (${formatPercent(quote.calculation.fee_percent)}):</td>
            <td style="padding: 8px 0; text-align: right;">${formatCurrency(quote.calculation.sponsor_fee)}</td>
          </tr>
          ${quote.calculation.include_tax ? `
          <tr>
            <td style="padding: 8px 0; color: #666;">Tax (IVA 16%):</td>
            <td style="padding: 8px 0; text-align: right;">${formatCurrency(quote.calculation.tax_amount)}</td>
          </tr>
          ` : ''}
          <tr style="font-size: 18px; font-weight: bold;">
            <td style="padding: 12px 0; border-top: 2px solid #ddd;">TOTAL INVESTMENT:</td>
            <td style="padding: 12px 0; text-align: right; border-top: 2px solid #ddd; color: #ff3300;">${formatCurrency(quote.calculation.grand_total)}</td>
          </tr>
        </table>
      </div>
      
      <h2 style="color: #333; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Benefits Included</h2>
      <ul style="list-style: none; padding: 0;">
        ${levelBenefits.map(b => `<li style="padding: 10px 0; border-bottom: 1px solid #eee;"><span style="color: #22c55e; margin-right: 10px;">✓</span>${b.name}</li>`).join('')}
      </ul>
      
      <div style="margin-top: 40px; padding: 20px; background: #fff3e0; border-radius: 8px; border-left: 4px solid #ff9800;">
        <h3 style="color: #333; margin: 0 0 10px 0; font-size: 16px;">Next Steps</h3>
        <p style="color: #666; margin: 0; font-size: 14px;">Contact us at <strong>sponsors@leaderlix.com</strong></p>
      </div>
    </div>
  `;
  
  const element = document.createElement("div");
  element.innerHTML = html;
  
  await html2pdf().set({
    margin: 10,
    filename: `sponsorship-quote-${quote.quote_id}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  }).from(element).save();
};

export default function SponsorshipPage() {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(null);
  const [error, setError] = useState(null);
  
  // Calculator state
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [coachingQty, setCoachingQty] = useState(0);
  const [includeTax, setIncludeTax] = useState(false);
  const [quote, setQuote] = useState(null);
  const [calculatingQuote, setCalculatingQuote] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [minCoaching, setMinCoaching] = useState({});

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  useEffect(() => {
    if (eventData && selectedLevel && coachingQty > 0) {
      calculateQuote();
    }
  }, [selectedLevel, coachingQty, includeTax, eventData]);

  const loadEventData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/sponsorship/event/${eventId}/public`);
      setEventData(response.data);
      
      // Calculate minimum coaching for each level
      const mins = {};
      for (const level of response.data.levels) {
        const calcRes = await api.post("/sponsorship/calculate/public", {
          event_id: eventId,
          level: level.code,
          coaching_qty: 1,
          include_tax: false
        });
        mins[level.code] = calcRes.data.quote.min_coaching;
      }
      setMinCoaching(mins);
    } catch (err) {
      console.error("Error loading event:", err);
      setError(err.response?.data?.detail || "Event not found");
    } finally {
      setLoading(false);
    }
  };

  const selectLevel = (levelCode) => {
    setSelectedLevel(levelCode);
    // Set to minimum coaching for this level
    const min = minCoaching[levelCode] || 1;
    setCoachingQty(min);
  };

  const calculateQuote = async () => {
    if (!eventData || !selectedLevel) return;
    
    setCalculatingQuote(true);
    try {
      const response = await api.post("/sponsorship/calculate/public", {
        event_id: eventId,
        level: selectedLevel,
        coaching_qty: coachingQty,
        include_tax: includeTax
      });
      setQuote(response.data.quote);
    } catch (err) {
      console.error("Error calculating quote:", err);
    } finally {
      setCalculatingQuote(false);
    }
  };

  const handleExportPdf = async () => {
    if (!quote) return;
    
    setGeneratingPdf(true);
    try {
      const saveResponse = await api.post("/sponsorship/quote", {
        event_id: eventId,
        level: selectedLevel,
        coaching_qty: coachingQty,
        include_tax: includeTax
      });
      
      const savedQuote = {
        ...saveResponse.data.quote,
        calculation: quote
      };
      
      await generatePDF(savedQuote, eventData.event.name, eventData.benefits, selectedLevel);
      toast.success(`Quote ${saveResponse.data.quote_id} exported to PDF`);
    } catch (err) {
      console.error("Error exporting PDF:", err);
      toast.error("Failed to export PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value) => `${(value * 100).toFixed(0)}%`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Card className="bg-[#111] border-[#222] max-w-md">
          <CardContent className="p-8 text-center">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Page Not Available</h2>
            <p className="text-slate-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { event, levels, benefits, pricing, content } = eventData;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border-b border-[#222]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <Badge className="bg-[#ff3300]/20 text-[#ff3300] mb-4">Sponsorship Opportunity</Badge>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            {content?.hero_title || "Become a Sponsor"}
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl">{content?.hero_subtitle || event.name}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Program Description */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">About the Program</h2>
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-6">
              <div className="prose prose-invert max-w-none text-slate-300"
                dangerouslySetInnerHTML={{ 
                  __html: (content?.program_description || "").replace(/\n/g, "<br/>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                }}
              />
            </CardContent>
          </Card>
        </section>

        {/* Why Sponsor */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Why Partner With Us</h2>
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-6">
              <div className="prose prose-invert max-w-none text-slate-300"
                dangerouslySetInnerHTML={{ 
                  __html: (content?.why_sponsor || "").replace(/\n/g, "<br/>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                }}
              />
            </CardContent>
          </Card>
        </section>

        {/* Sponsorship Levels with Integrated Calculator */}
        <section className="mb-16" id="levels">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-[#ff3300]" />
            Select Your Sponsorship Level
          </h2>
          
          {/* Level Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {levels.map((level) => {
              const isSelected = selectedLevel === level.code;
              const levelBenefits = benefits.filter(b => b[level.code] === true);
              const minQty = minCoaching[level.code] || 0;
              
              return (
                <Card 
                  key={level.code}
                  className={`relative cursor-pointer transition-all duration-300 ${
                    isSelected 
                      ? 'bg-[#ff3300]/10 border-[#ff3300] ring-2 ring-[#ff3300]/50' 
                      : 'bg-[#111] border-[#222] hover:border-[#333]'
                  }`}
                  onClick={() => selectLevel(level.code)}
                >
                  {isSelected && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-[#ff3300] text-white">Selected</Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl text-white">{level.name}</CardTitle>
                    <div className="flex flex-col items-center gap-2 mt-2">
                      <div className="text-sm text-slate-400">
                        Starting at <span className="text-[#ff3300] font-bold text-lg">{formatCurrency(level.min_investment)}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        (min. {minQty} scholarships)
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-4">
                    {/* Benefits List */}
                    <div className="space-y-2">
                      {benefits.map((benefit) => (
                        <div key={benefit.code} className="flex items-center gap-2 text-sm">
                          {benefit[level.code] ? (
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-slate-600 flex-shrink-0" />
                          )}
                          <span className={benefit[level.code] ? 'text-slate-300' : 'text-slate-600'}>
                            {benefit.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Select Button */}
                    <Button 
                      className={`w-full mt-6 ${
                        isSelected 
                          ? 'bg-[#ff3300] hover:bg-[#e62e00]' 
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                      onClick={(e) => { e.stopPropagation(); selectLevel(level.code); }}
                    >
                      {isSelected ? 'Selected' : 'Select This Level'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Calculator Panel - Shows when level is selected */}
          {selectedLevel && (
            <Card className="bg-gradient-to-br from-[#111] to-[#1a1a1a] border-[#ff3300]/30 border-2">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#ff3300]" />
                  Configure Your Investment - {levels.find(l => l.code === selectedLevel)?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Quantity Selector */}
                  <div className="space-y-6">
                    <div>
                      <Label className="text-slate-300 mb-3 block">Number of Coaching Scholarships</Label>
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCoachingQty(Math.max(minCoaching[selectedLevel] || 1, coachingQty - 1))}
                          disabled={coachingQty <= (minCoaching[selectedLevel] || 1)}
                          className="border-[#333] h-12 w-12 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-5 h-5" />
                        </Button>
                        <div className="flex-1 text-center">
                          <div className="text-4xl font-black text-white">{coachingQty}</div>
                          <div className="text-xs text-slate-500">scholarships</div>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCoachingQty(coachingQty + 1)}
                          className="border-[#333] h-12 w-12 hover:border-[#ff3300] hover:text-[#ff3300]"
                        >
                          <Plus className="w-5 h-5" />
                        </Button>
                      </div>
                      <div className="text-center mt-2">
                        <span className="text-sm text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded-full">
                          ⚠️ Minimum: {minCoaching[selectedLevel] || 0} scholarships
                        </span>
                      </div>
                    </div>
                    
                    {/* Tax Toggle */}
                    <div className="flex items-center justify-between pt-4 border-t border-[#222]">
                      <Label className="text-slate-300">Include IVA (16%)</Label>
                      <Switch checked={includeTax} onCheckedChange={setIncludeTax} />
                    </div>
                  </div>
                  
                  {/* Right: Quote Summary */}
                  <div className="bg-[#0a0a0a] rounded-lg p-6">
                    {calculatingQuote ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-[#ff3300]" />
                      </div>
                    ) : quote ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-[#222]">
                          <span className="text-slate-400">Scholarships ({quote.coaching.quantity})</span>
                          <span className="text-white">{formatCurrency(quote.coaching.subtotal)}</span>
                        </div>
                        
                        {quote.coaching.discount_percent > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-green-400">Volume Discount</span>
                            <span className="text-green-400">-{formatPercent(quote.coaching.discount_percent)}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center py-2 border-b border-[#222]">
                          <span className="text-slate-400">Program Management</span>
                          <span className="text-white">{formatCurrency(quote.sponsor_fee)}</span>
                        </div>
                        
                        {quote.include_tax && (
                          <div className="flex justify-between items-center py-2 border-b border-[#222]">
                            <span className="text-slate-400">IVA (16%)</span>
                            <span className="text-white">{formatCurrency(quote.tax_amount)}</span>
                          </div>
                        )}
                        
                        <div className="bg-[#ff3300]/10 rounded-lg p-4 mt-4">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-white">Total Investment</span>
                            <span className="text-2xl font-black text-[#ff3300]">
                              {formatCurrency(quote.grand_total)}
                            </span>
                          </div>
                          {!quote.meets_minimum && (
                            <p className="text-xs text-red-400 mt-2">
                              ⚠️ Below minimum investment for this level
                            </p>
                          )}
                        </div>
                        
                        <Button 
                          onClick={handleExportPdf}
                          className="w-full bg-[#ff3300] hover:bg-[#e62e00] mt-4"
                          disabled={generatingPdf || !quote.meets_minimum}
                        >
                          {generatingPdf ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Export Quote to PDF
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        Configure scholarships to see your quote
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* FAQ Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-6">
              <div className="prose prose-invert max-w-none text-slate-300"
                dangerouslySetInnerHTML={{ 
                  __html: (content?.faq || "").replace(/\n/g, "<br/>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                }}
              />
            </CardContent>
          </Card>
        </section>

        {/* Contact Section */}
        <section className="mb-16">
          <Card className="bg-gradient-to-r from-[#ff3300]/10 to-[#111] border-[#ff3300]/30">
            <CardContent className="p-8 text-center">
              <Mail className="w-12 h-12 text-[#ff3300] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Ready to Partner?</h2>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                {content?.contact_info || "Contact us to discuss sponsorship opportunities"}
              </p>
              <Button className="bg-[#ff3300] hover:bg-[#e62e00]">
                <Mail className="w-4 h-4 mr-2" />
                Contact Us
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Terms */}
        <div className="text-center text-slate-500 text-sm">
          <p>{content?.terms}</p>
        </div>
      </div>
    </div>
  );
}
