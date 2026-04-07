import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "SEO Dashboard",
  description: "Something Inc. SEO Automation Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full font-[family-name:var(--font-geist)]">
        {/* Light pastel aurora background */}
        <div className="fixed inset-0 -z-10 overflow-hidden bg-[#FAFAFB]">
          <div
            className="absolute -top-48 -left-48 w-[900px] h-[900px] rounded-full opacity-[0.05]"
            style={{ background: "radial-gradient(ellipse, #8B5CF6 0%, transparent 70%)", animation: "aurora1 14s ease-in-out infinite alternate" }}
          />
          <div
            className="absolute -bottom-36 -right-24 w-[700px] h-[700px] rounded-full opacity-[0.04]"
            style={{ background: "radial-gradient(ellipse, #FB7185 0%, transparent 70%)", animation: "aurora2 18s ease-in-out infinite alternate" }}
          />
          <div
            className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full opacity-[0.03]"
            style={{ background: "radial-gradient(ellipse, #38BDF8 0%, transparent 70%)", animation: "aurora3 22s ease-in-out infinite alternate", transform: "translate(-50%, -50%)" }}
          />
        </div>
        <style>{`
          @keyframes aurora1 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(80px,60px) scale(1.15); } }
          @keyframes aurora2 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(-60px,-80px) scale(1.1); } }
          @keyframes aurora3 { 0% { transform: translate(-50%,-50%) scale(1) rotate(0deg); } 100% { transform: translate(-50%,-50%) scale(1.2) rotate(20deg); } }
        `}</style>
        {children}
      </body>
    </html>
  );
}
