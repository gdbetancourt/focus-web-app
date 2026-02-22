import { useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Quote, Star, ChevronLeft, ChevronRight, Play, RefreshCw } from "lucide-react";

/**
 * TestimonialCarousel - Reusable carousel component for displaying testimonials
 * 
 * Props:
 * - pageId: string - The page identifier to fetch testimonials for (e.g., "home", "lms", "blog")
 * - limit: number - Maximum number of testimonials to display (default: 6)
 * - title: string - Optional custom title (default: "Lo que dicen nuestros clientes")
 * - autoPlay: boolean - Auto-rotate testimonials (default: true)
 * - autoPlayInterval: number - Interval in ms for auto-rotation (default: 5000)
 */
export default function TestimonialCarousel({
  pageId = "home",
  limit = 6,
  title = "Lo que dicen nuestros clientes",
  autoPlay = true,
  autoPlayInterval = 5000,
}) {
  const [testimonials, setTestimonials] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTestimonials();
  }, [pageId]);

  useEffect(() => {
    if (!autoPlay || testimonials.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, autoPlayInterval);
    
    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, testimonials.length]);

  const loadTestimonials = async () => {
    try {
      // Try page-specific endpoint first, fall back to general public
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      let res;
      try {
        res = await fetch(`${API_URL}/api/testimonials/by-page/${pageId}?limit=${limit}`);
        res = await res.json();
      } catch {
        res = await fetch(`${API_URL}/api/testimonials/public?limit=${limit}`);
        res = await res.json();
      }
      setTestimonials(res.testimonials || []);
    } catch (error) {
      console.error("Error loading testimonials:", error);
      setTestimonials([]);
    } finally {
      setLoading(false);
    }
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const renderStars = (rating) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-slate-600"
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  if (testimonials.length === 0) {
    return null; // Don't render anything if no testimonials
  }

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section className="py-16 bg-[#0a0c10]">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="bg-[#ff3300]/20 text-[#ff3300] border-0 mb-4">
            Testimonios
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-white">{title}</h2>
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Navigation Buttons */}
          {testimonials.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-[#111] border border-[#222] text-slate-400 hover:text-white hover:bg-[#222]"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-[#111] border border-[#222] text-slate-400 hover:text-white hover:bg-[#222]"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </>
          )}

          {/* Main Testimonial Card */}
          <Card className="bg-[#111] border-[#222] max-w-3xl mx-auto">
            <CardContent className="p-8 md:p-12">
              {/* Quote Icon */}
              <Quote className="w-12 h-12 text-[#ff3300]/30 mb-6" />

              {/* Testimonial Text */}
              <blockquote className="text-lg md:text-xl text-slate-300 leading-relaxed mb-8 italic">
                &ldquo;{currentTestimonial.testimonio}&rdquo;
              </blockquote>

              {/* Author Info */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="font-semibold text-white text-lg">
                    {currentTestimonial.nombre}{" "}
                    {currentTestimonial.apellido && currentTestimonial.apellido}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    {currentTestimonial.industria_name && (
                      <span>{currentTestimonial.industria_name}</span>
                    )}
                    {currentTestimonial.programa_name && (
                      <>
                        <span>•</span>
                        <span>{currentTestimonial.programa_name}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {currentTestimonial.rating_resultados && 
                    renderStars(currentTestimonial.rating_resultados)}
                  
                  {currentTestimonial.video_vimeo && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#333] text-slate-300"
                      onClick={() => window.open(currentTestimonial.video_vimeo, "_blank")}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Ver Video
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dots Indicator */}
          {testimonials.length > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? "bg-[#ff3300] w-6"
                      : "bg-slate-600 hover:bg-slate-500"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* View All Link */}
        <div className="text-center mt-8">
          <Button
            variant="outline"
            className="border-[#333] text-slate-300 hover:text-white"
            onClick={() => window.open("/muro", "_self")}
          >
            Ver todos los testimonios
          </Button>
        </div>
      </div>
    </section>
  );
}
