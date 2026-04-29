"use client";

import { AuthProvider } from "@/components/AuthProvider";
import { HorseProvider } from "@/components/HorseProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <HorseProvider>{children}</HorseProvider>
    </AuthProvider>
  );
}
