import React, { createContext, useContext, useState } from 'react';

const TooltipContext = createContext({});

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipContext.Provider value={{}}>{children}</TooltipContext.Provider>;
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function TooltipTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  return <>{children}</>;
}

export function TooltipContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return null;
}
