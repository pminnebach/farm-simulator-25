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
    // ponytail: no ColorSchemeScript — the app is light-only, so mantineHtmlProps'
    // data-mantine-color-scheme="light" is enough. Add it back with a scheme toggle.
    <html lang="en" {...mantineHtmlProps}>
      <body>
        <MantineProvider forceColorScheme="light">
          <AppShellLayout>{children}</AppShellLayout>
        </MantineProvider>
      </body>
    </html>
  );
}
