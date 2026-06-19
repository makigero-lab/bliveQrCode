import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

export default function RequireAuth({ children }) {
  const [status, setStatus] = useState("loading"); // "loading" | "ok" | "redirect"

  useEffect(() => {
    base44.auth.me()
      .then(() => setStatus("ok"))
      .catch(() => {
        setStatus("redirect");
        base44.auth.redirectToLogin(window.location.href);
      });
  }, []);

  if (status === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "redirect") return null;

  return children;
}