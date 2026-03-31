"use client";

import Link from "next/link";
import { motion, useMotionTemplate, useScroll, useTransform } from "framer-motion";
import { useMemo, useRef, useState } from "react";

type FeatureCard = {
  title: string;
  text: string;
  accent: "green" | "blue";
  size: "large" | "small";
};

const cards: FeatureCard[] = [
  {
    title: "Checkout Pix Instantaneo",
    text: "Finalizacao simples e rapida para o cliente no link do Instagram.",
    accent: "green",
    size: "large",
  },
  {
    title: "Painel Admin",
    text: "Cadastro de produtos, controle de pedidos e configuracao da chave Pix.",
    accent: "blue",
    size: "small",
  },
  {
    title: "Controle de Entregas",
    text: "Visualize enderecos e status dos pedidos em tempo real.",
    accent: "green",
    size: "small",
  },
  {
    title: "Dashboard Diario",
    text: "Faturamento, pedidos do dia e volume de produtos cadastrados.",
    accent: "blue",
    size: "large",
  },
];

function TiltCard({ card, index }: { card: FeatureCard; index: number }) {
  const [cursor, setCursor] = useState({ x: 50, y: 50 });

  const glow = useMemo(() => {
    return {
      background:
        card.accent === "green"
          ? `radial-gradient(circle at ${cursor.x}% ${cursor.y}%, rgba(178,255,0,0.26), transparent 45%)`
          : `radial-gradient(circle at ${cursor.x}% ${cursor.y}%, rgba(0,170,255,0.26), transparent 45%)`,
    };
  }, [card.accent, cursor.x, cursor.y]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: "easeOut" }}
      whileHover={{ rotateX: 4, rotateY: -4, scale: 1.01 }}
      onMouseMove={(event) => {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        setCursor({ x, y });
      }}
      className={`group relative overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#080808]/90 p-6 backdrop-blur-xl ${
        card.size === "large" ? "md:col-span-2" : "md:col-span-1"
      }`}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={glow} />
      <h3 className="relative text-xl font-extrabold tracking-tight text-white">{card.title}</h3>
      <p className="relative mt-3 text-sm leading-relaxed text-zinc-400">{card.text}</p>
    </motion.article>
  );
}

export default function LandingPage() {
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.5]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.25]);

  const { scrollY } = useScroll();
  const headerBlurPx = useTransform(scrollY, [0, 100], [0, 14]);
  const headerOpacity = useTransform(scrollY, [0, 100], [0, 0.72]);
  const headerBg = useMotionTemplate`rgba(8, 8, 8, ${headerOpacity})`;
  const headerFilter = useMotionTemplate`blur(${headerBlurPx}px)`;

  return (
    <div className="relative min-h-screen bg-black text-white">
      <motion.header
        style={{
          backdropFilter: headerFilter,
          backgroundColor: headerBg,
        }}
        className="sticky top-0 z-50 border-b border-transparent px-4 py-3 sm:px-5 sm:py-4"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-3">
          <div className="text-sm font-black tracking-[0.12em] sm:text-lg sm:tracking-[0.16em]">SOLAR SUPERMERCADO</div>
          <div className="flex items-center gap-2 text-xs sm:gap-3 sm:text-sm">
            <Link href="/loja" className="rounded-full border border-[#1A1A1A] px-3 py-2 hover:border-[#B2FF00] sm:px-4">
              Link Instagram
            </Link>
            <Link href="/admin" className="rounded-full bg-[#00AAFF] px-3 py-2 font-semibold text-black hover:bg-[#33bdff] sm:px-4">
              Painel Admin
            </Link>
          </div>
        </div>
      </motion.header>

      <main>
        <section ref={heroRef} className="relative mx-auto grid min-h-[72vh] max-w-6xl place-items-center px-4 py-10 sm:min-h-[85vh] sm:px-5 sm:py-16">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(0,170,255,0.26),transparent_45%),radial-gradient(circle_at_80%_40%,rgba(178,255,0,0.22),transparent_45%)]" />
          <motion.div style={{ scale: heroScale, opacity: heroOpacity }} className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#1A1A1A] bg-[#080808] p-6 shadow-[0_0_60px_rgba(0,170,255,0.16)] sm:rounded-[2.4rem] sm:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,rgba(255,255,255,0.06),transparent_40%)]" />
            <h1 className="text-balance text-3xl font-black leading-tight tracking-tight sm:text-6xl">
              Carrinho Mobile
              <span className="block text-[#B2FF00]">Solar Supermercado</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:mt-5 sm:text-base">
              Estrutura web mobile para vender pelo Instagram com painel administrativo, pedidos por API Flask,
              entrega com endereco e checkout Pix.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 sm:mt-8 sm:gap-3">
              <Link href="/loja" className="rounded-full bg-[#B2FF00] px-6 py-3 text-sm font-black text-black hover:bg-[#cbff4d]">
                Abrir Loja
              </Link>
              <Link href="/admin" className="rounded-full border border-[#1A1A1A] px-6 py-3 text-sm font-semibold hover:border-[#00AAFF]">
                Gerenciar Sistema
              </Link>
            </div>
          </motion.div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 pb-20">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">Bento Grid de Recursos</h2>
            <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Visual Synthesis</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {cards.map((card, index) => (
              <TiltCard key={card.title} card={card} index={index} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
