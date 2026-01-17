"use client";

import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SessionProvider>
      {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
    </SessionProvider>
  );
}