// Screen 01 — SIGARAM64 Landing / Marketing Home Page
import React from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Badge, FeatureCard, SectionHeader, StatCard } from "../../ui";
import logoHorizontal from "../../../assets/Images/Logo/sigaram64_horizontal_transparent_3000.png";
import { useAuth } from "../../../context/AuthContext";
import HeroBoardPreview from "../../chess/HeroBoardPreview";

const PILLARS = [
  { icon: "🧠", title: "Adaptive Assessment", tag: "Phase 1 · Live", desc: "8–12 min CAT engine. Board clicks only — no notation typing. Elo 400–2400. Bilingual Tamil & English. Accurate from first attempt." },
  { icon: "♟", title: "AI Game Analysis", tag: "Phase 1 · Live", desc: "Brilliant/Blunder icons. Phase-weighted mistakes. Skill-normalised scoring." },
  { icon: "🎙", title: "Tamil Voicebot Coach", tag: "Phase 1 · Live", desc: "Sarvam AI Tamil + ElevenLabs English. Sub-500ms response. 95%+ accuracy on chess terms. Puzzle hints & analysis narration." },
];

const COMING_SOON = [
  { icon: "🗺️", title: "Campaign Map", desc: "23-level chess journey. XP, streaks, hearts, badges, avatar customisation." },
  { icon: "🎬", title: "Video Lessons", desc: "Interactive video lesssons with playing experience" },
  { icon: "🏫", title: "Virtual Live Classes", desc: "AI chess move detection. Auto post-class puzzle packs." },
  { icon:"🏆", title:"Tournament Manager",   desc:"Swiss · Arena · Round Robin. Full bracket with auto-pairing and live results." },
  { icon:"♟",  title:"Endgame Lab",          desc:"E1–E10: Basic -Grandmaster level endings. Structured progression." },
  { icon:"🤖", title:"Mantri AI Advisor",    desc:"World's first Tamil-speaking chess AI advisor for learning" },
  { icon:"📱", title:"Native Mobile App",    desc:"iOS + Android. Offline-first puzzle play. Syncs when connection returns." },
  { icon:"🌍", title:"Global Expansion",     desc:"Tamil → Hindi → Arabic → Spanish. FIDE partnership track for international scale." },
];

const SDAT_FEATURES = [
  { icon:"📍", title:"GPS Activity Proof",       desc:"Managers upload GPS-tagged photos & videos of every bootcamp. Auto-timestamped. Undeniable proof of activity for district officers." },
  { icon:"✅", title:"Auto Attendance Tracking", desc:"Daily bootcamp attendance tracked digitally. Coach remarks per student. No paper registers. Everything syncs to reports instantly." },
  { icon:"📄", title:"One-Click Renewal Reports",desc:"Professional PDF per student, school & district. Platform usage, rating progress, puzzle stats — exactly what district officers need." },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-dark-bg font-sans">

      {/* ── NAVBAR ── */}
      <nav className="w-full bg-navy border-b-2 border-gold px-6 lg:px-20 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={logoHorizontal} alt="SIGARAM64 Logo" className="h-12 w-auto object-contain" />
        </div>
        {/* <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-300">
          {["Features","Assessment","For Schools","Districts","Blog"].map(l => (
            <a key={l} href="#" className="hover:text-gold transition-colors">{l}</a>
          ))}
        </div> */}
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-xs font-medium text-gold bg-navy-mid border border-gold/30 px-3 py-1 rounded-full cursor-pointer">EN | தமிழ்</span>
          {isAuthenticated ? (
            <button onClick={() => navigate('/home')} className="btn-gold text-sm px-5 py-2">Dashboard</button>
          ) : (
            <>
              <button onClick={() => navigate('/login')} className="text-sm text-gray-300 hover:text-white transition-colors">Login</button>
              <button onClick={() => navigate('/assessment')} className="btn-gold text-sm px-5 py-2">Start Free</button>
            </>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative bg-dark-bg overflow-hidden px-6 lg:px-20 pt-20 pb-24 flex flex-col lg:flex-row items-center gap-16">
        {/* Grid lines */}
        {Array.from({length:8}).map((_,i) => (
          <div key={i} className="absolute left-0 right-0 h-px bg-white/[0.03]" style={{top: 60 + i*80}} />
        ))}

        {/* Left copy */}
        <div className="flex-1 z-10 max-w-xl">
          <h1 className="text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            <span className="text-white">India's First </span>
            <span className="text-gold">AI Chess Education </span>
            <span className="text-white">Platform for Schools</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed mb-3">
            Serving 1,048+ students across Tamil Nadu districts. AI-powered assessment · Tamil Voicebot
          </p>
          <p className="text-gold-light text-base mb-8">தமிழகத்தின் முதல் AI சதுரங்க கல்விதளம்</p>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => navigate('/assessment')} className="btn-gold px-8 py-4 text-base">Start Free Assessment</button>
            {isAuthenticated ? (
              <button onClick={() => navigate('/home')} className="btn-outline-gold px-8 py-4 text-base">Go to Dashboard →</button>
            ) : (
              <button onClick={() => navigate('/login')} className="btn-outline-gold px-8 py-4 text-base">Book School Demo →</button>
            )}
          </div>
        </div>

        {/* Right — 3D Chess Board Visual */}
        <div className="flex-1 flex items-center justify-center z-10">
          <HeroBoardPreview size={352} />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      {/* <section className="bg-navy border-y-2 border-gold/40 px-6 lg:px-20 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { n:"1,048+",   l:"Students Trained" },
            { n:"10+",      l:"Districts Covered" },
            { n:"400–2200", l:"Elo Range Served" },
          ].map((s,i) => (
            <div key={i} className="text-center lg:text-center" >
              <div className="text-gold text-3xl lg:text-4xl font-bold">{s.n}</div>
              <div className="text-gray-400 text-sm mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section> */}

      {/* ── FOUR PILLARS ── */}
      <section className="px-6 lg:px-20 py-20 bg-dark-bg">
        <SectionHeader
          title="Built for Every Chess Journey"
          sub="Four AI-powered systems working together to assess, train, coach, and report."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 mt-12">
          {PILLARS.map((p,i) => <FeatureCard key={i} {...p} />)}
        </div>
      </section>

      {/* ── FOR GOVERNMENT SCHOOLS / SDAT ── */}
      {/* <section className="px-6 lg:px-20 py-20 bg-navy">
        <div className="max-w-3xl mb-12">
          <SectionHeader
            title="Built for Government Schools & SDAT"
            sub="Purpose-built for district-scale chess education. Everything a state renewal officer needs on one screen."
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {SDAT_FEATURES.map((f,i) => (
            <div key={i} className="card p-6">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="text-white text-lg font-semibold leading-tight">{f.title}</h3>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
        <button className="btn-gold px-8 py-4 text-base">Book a District Demo →</button>
      </section> */}

      {/* ── COMING SOON SHELF ── */}
      <section className="px-6 lg:px-20 py-20 bg-dark-bg">
        <SectionHeader
          title="The Full Vision — Coming in Phase 2 & 3"
          sub="Every feature is planned, sequenced, and coming. Watch this space."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          {COMING_SOON.map((c,i) => <FeatureCard key={i} {...c} comingSoon />)}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-navy border-t-2 border-gold px-6 lg:px-20 py-20 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 max-w-2xl mx-auto">
          Your students deserve world-class chess education.
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          Free assessment for every student. No credit card. Government-school ready.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button className="btn-gold px-8 py-4 text-base">Start Free Assessment</button>
          <button className="btn-outline-gold px-8 py-4 text-base">Contact for Districts</button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-dark-bg border-t-2 border-gold px-6 lg:px-20 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Crown size={20} />
              <span className="text-gold text-lg font-bold">SIGARAM64</span>
            </div>
            <p className="text-gray-400 text-sm">India's First AI Chess Education Platform</p>
            <p className="text-gold-light text-xs mt-1">தமிழகத்தின் முதல் AI சதுரங்க கல்விதளம்</p>
            <p className="text-gray-500 text-xs mt-3">By Chess Bishop · Dr. Prof. SuryaKumar S A, FIDE National Instructor</p>
          </div>
          {/* Link columns */}
          {[
            { h:"Platform",    ls:["Assessment","Game Analysis","Puzzle Training","Voicebot Coach"] },
            { h:"For Schools", ls:["District Programs","SDAT Partnership","Bulk Enrolment","Renewal Reports"] },
            { h:"Company",     ls:["About","Blog","Careers","Contact"] },
            { h:"Coming Soon", ls:["Campaign Map","Video Lessons","Live Classes","Mobile App"] },
          ].map(col => (
            <div key={col.h}>
              <h4 className="text-gold text-sm font-semibold mb-4">{col.h}</h4>
              <ul className="space-y-2">
                {col.ls.map(l => <li key={l}><a href="#" className="text-gray-400 text-sm hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-divider mt-12 pt-6 text-gray-600 text-xs">
          © 2026 SIGARAM64 · Chess Bishop · All rights reserved 
        </div>
      </footer>
    </div>
  );
}
