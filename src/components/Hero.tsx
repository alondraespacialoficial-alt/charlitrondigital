import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, ArrowRight, CheckCircle2, ChevronDown, Play, Pause } from 'lucide-react';
import { PHONE_DISPLAY, createWhatsAppUrl, HERO_VIDEO_SRC } from '../data/content';
import { CharlitronLogo } from './CharlitronLogo';

export const Hero: React.FC = () => {
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const whatsappGeneralUrl = createWhatsAppUrl(
    'Hola Charlitron Digital, vi su página web y quiero platicar sobre una solución digital para mi negocio.'
  );

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, []);

  const toggleVideoPlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      id="inicio"
      className="relative min-h-[calc(100vh-5rem)] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-16 md:py-24 overflow-hidden bg-grid-pattern"
    >
      {/* Background Video (Mexican team collaborating with Charlitron mural) */}
      {!videoError && HERO_VIDEO_SRC && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            poster="/hero-video-poster.jpg"
            onLoadedData={() => setVideoLoaded(true)}
            onError={() => setVideoError(true)}
            className={`w-full h-full object-cover transition-opacity duration-1000 contrast-[1.06] brightness-[0.98] saturate-[1.12] ${
              videoLoaded ? 'opacity-70 sm:opacity-75' : 'opacity-0'
            }`}
          >
            <source src={HERO_VIDEO_SRC} type="video/mp4" />
          </video>
          {/* Balanced cinematic overlays: lets the video shine through while keeping typography crisp */}
          <div className="absolute inset-0 bg-[#09090b]/45" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/85 via-transparent to-[#09090b]" />
          <div className="absolute inset-0 bg-radial-[circle_at_50%_40%] from-transparent via-[#09090b]/30 to-[#09090b]/80" />
        </div>
      )}

      {/* Video Control Toggle */}
      {!videoError && videoLoaded && (
        <button
          onClick={toggleVideoPlayback}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-amber-400 transition-colors backdrop-blur-md cursor-pointer text-xs shadow-lg"
          aria-label={isPlaying ? 'Pausar video de fondo' : 'Reproducir video de fondo'}
          title={isPlaying ? 'Pausar video de fondo' : 'Reproducir video de fondo'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3 h-3" />
              <span className="text-[11px] font-medium hidden sm:inline">Pausar</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current text-amber-400" />
              <span className="text-[11px] font-medium hidden sm:inline">Reproducir</span>
            </>
          )}
        </button>
      )}

      {/* Subtle radial tech gradient in background */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, rgba(250, 204, 21, 0.12) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
        {/* Brand Badge with Triangle Emblem */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-zinc-900/90 border border-amber-400/30 text-xs sm:text-sm font-medium text-zinc-200 shadow-[0_0_25px_rgba(250,204,21,0.12)]">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="tracking-wide uppercase font-semibold text-amber-400">
              CHARLITRON DIGITAL
            </span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-300">El brazo tecnológico de Charlitron</span>
          </div>
        </motion.div>

        {/* Hero Geometric Visual Emblem */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8 relative"
        >
          <div className="rounded-full border border-amber-400/20 bg-zinc-950/40 p-4 shadow-[0_0_80px_rgba(250,204,21,0.12)] backdrop-blur-sm">
            <CharlitronLogo size="hero" showText={false} />
          </div>
          {/* Subtle tech aura behind logo */}
          <div className="absolute -inset-4 bg-amber-400/10 blur-xl -z-10 rounded-full" />
        </motion.div>

        {/* Main Headline (Lema principal) */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="font-display font-black text-4xl sm:text-6xl lg:text-7xl tracking-tight text-white mb-6 leading-[1.08] drop-shadow-[0_4px_28px_rgba(0,0,0,0.9)]"
        >
          Soluciones digitales{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 drop-shadow-[0_2px_20px_rgba(250,204,21,0.3)]">
            para negocios.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-lg sm:text-2xl text-zinc-200 font-normal max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]"
        >
          Webs, apps, automatizaciones e IA para simplificar procesos, vender mejor y ahorrar tiempo.
        </motion.p>

        {/* Main Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 mb-8"
        >
          <button
            onClick={() => handleScrollTo('necesidades')}
            className="amber-button inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl text-zinc-950 font-bold text-base hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <span>Cuéntanos qué necesitas</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => handleScrollTo('soluciones')}
            className="dark-button inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-zinc-100 border border-zinc-700 hover:border-amber-400/50 hover:bg-zinc-800/90 active:scale-[0.98] transition-all text-base font-semibold cursor-pointer"
          >
            <span>Ver lo que hacemos</span>
          </button>
        </motion.div>

        {/* WhatsApp Direct Access Banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="inline-flex flex-wrap items-center justify-center gap-3 px-5 py-2.5 rounded-full bg-zinc-900/70 border border-zinc-800 text-xs sm:text-sm text-zinc-400"
        >
          <span className="flex items-center gap-1.5 text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            Atención directa y sin rodeos
          </span>
          <span className="hidden sm:inline text-zinc-600">•</span>
          <a
            href={whatsappGeneralUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-amber-400 font-semibold hover:underline"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            WhatsApp: {PHONE_DISPLAY}
          </a>
        </motion.div>
      </div>

      {/* Subtle Scroll Down Prompt */}
      <motion.button
        onClick={() => handleScrollTo('soluciones')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="mt-12 text-zinc-500 hover:text-amber-400 transition-colors flex flex-col items-center gap-1 text-xs cursor-pointer"
        aria-label="Desplazar a soluciones"
      >
        <span>Conoce nuestras soluciones</span>
        <ChevronDown className="w-4 h-4 animate-bounce" />
      </motion.button>
    </section>
  );
};
