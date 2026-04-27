import { createContext, useContext } from "react";

export const StackContext = createContext<{ stackId: number } | null>(null);

export function useStack() {
  const ctx = useContext(StackContext);
  if (!ctx) throw new Error("useStack must be used within StackLayout");
  return ctx;
}
