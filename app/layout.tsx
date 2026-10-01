import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { InsightHeader } from "@/components/InsightHeader";
import { InsightSidebar } from "@/components/InsightSidebar";
import { SearchProvider } from "@/lib/search-context";
import { SidebarProvider } from "@/lib/sidebar-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "INSIGHT — ROMABC x Green+",
  description: "Inteligência para decisões melhores: reuniões, ATAs e clientes num só lugar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${montserrat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SearchProvider>
            <SidebarProvider>
              <div className="flex min-h-screen">
                <InsightSidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                  <InsightHeader />
                  <div className="flex flex-1 flex-col">{children}</div>
                </div>
              </div>
            </SidebarProvider>
          </SearchProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
