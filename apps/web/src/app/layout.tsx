import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "MediCita RD", template: "%s · MediCita RD" },
  description:
    "MediCita RD — Tu salud, nuestra prioridad. Agenda, paga y da seguimiento a tus citas médicas y estudios en República Dominicana.",
};

export const viewport: Viewport = { themeColor: "#1A6FE0" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-DO">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster theme="light" position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
