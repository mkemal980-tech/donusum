"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange={false}
      >
        {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
        <Toaster 
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            className: 'dark:bg-dark-card dark:border-dark-border dark:text-gray-100',
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
