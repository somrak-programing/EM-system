import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "TCPR แจ้งซ่อม",
  description: "ระบบแจ้งซ่อมเครื่องจักร ไฟฟ้า งานพนักงาน และ IT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${noto.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
