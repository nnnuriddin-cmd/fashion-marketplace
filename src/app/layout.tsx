import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/customer/Navbar';
import Footer from '@/components/customer/Footer';
import { CartProvider } from '@/lib/cart-context';
import { LanguageProvider } from '@/lib/language-context';

export const metadata: Metadata = {
  title: 'TrendMall | Multi-Vendor AI Digital Fashion Mall',
  description: 'Discover physical boutiques, designer brands, and Instagram fashion stores inside one digital marketplace.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col justify-between">
        <LanguageProvider><CartProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider></LanguageProvider>
      </body>
    </html>
  );
}
