"use client";

import { useEffect } from "react";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply theme from localStorage on page load
    const savedTheme = localStorage.getItem("theme") || "light";
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    
    if (savedTheme === "dark") {
      htmlElement.classList.add("dark");
      bodyElement.classList.add("dark");
      htmlElement.classList.remove("light");
      bodyElement.classList.remove("light");
    } else {
      htmlElement.classList.remove("dark");
      bodyElement.classList.remove("dark");
      htmlElement.classList.add("light");
      bodyElement.classList.add("light");
    }
  }, []);

  return <>{children}</>;
}
