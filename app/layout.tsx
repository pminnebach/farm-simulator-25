import "@mantine/core/styles.css";

import { MantineProvider, mantineHtmlProps } from "@mantine/core";
import type { Metadata } from "next";
import { AppShellLayout } from "@/components/AppShellLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Farm Manager",
  description: "Track fields and harvests for Farming Simulator 25",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <body>
        <MantineProvider defaultColorScheme="light">
          <AppShellLayout>{children}</AppShellLayout>
        </MantineProvider>
      </body>
    </html>
  );
}
