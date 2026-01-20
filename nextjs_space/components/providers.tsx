"use client";

import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SessionProvider>
      {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
      <Toaster 
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: '#fff',
            border: '1px solid #e5e7eb',
          },
        }}
      />
    </SessionProvider>
  );
}