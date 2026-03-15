"use client";

import React from "react";
// Next.js Link yapısını asıl projedeki dashboard/login bağlantıları için kullanıyoruz
import Link from "next/link";

/* ─── Yeni Tasarım Komponentleri ─── */
// Not: Bu komponentlerin 'src/components/landing/' klasörüne taşındığını varsayıyoruz.
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { Security } from "@/components/landing/security";
import { Pricing } from "@/components/landing/pricing";
import { CTA } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

/**
 * TRAE NOTU: 
 * Yeni tasarımda butonlar genellikle standart <button> veya <a> etiketidir.
 * Eğer yeni tasarımın içindeki 'Hero' veya 'Navbar' komponentlerinde 
 * 'Sign In' veya 'Get Started' butonları varsa, o dosyalara gidip 
 * href kısımlarını asıl projenin /login ve /signup yollarına bağlamayı unutma.
 */

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      {/* Yeni Modern Tasarım Katmanları */}
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <Security />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}