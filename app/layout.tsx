import "@mantine/core/styles.css";

import { createTheme, MantineProvider, mantineHtmlProps } from "@mantine/core";
import type { Metadata } from "next";
import { AppShellLayout } from "@/components/AppShellLayout";
import "./globals.css";

const theme = createTheme({
  components: {
    NumberInput: {
      defaultProps: {
        thousandSeparator: ".",
        decimalSeparator: ",",
      },
    },
  },
});

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
        <MantineProvider theme={theme} defaultColorScheme="light">
          <AppShellLayout>{children}</AppShellLayout>
        </MantineProvider>
      </body>
    </html>
  );
}
