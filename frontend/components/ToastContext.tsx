"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (msg: Omit<ToastMessage, "id">) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let globalToastHandler: ((msg: Omit<ToastMessage, "id">) => void) | null = null;

export const toast = {
  success: (message: string, title?: string) => {
    if (globalToastHandler) globalToastHandler({ type: "success", message, title });
  },
  error: (message: string, title?: string) => {
    if (globalToastHandler) globalToastHandler({ type: "error", message, title });
  },
  warning: (message: string, title?: string) => {
    if (globalToastHandler) globalToastHandler({ type: "warning", message, title });
  },
  info: (message: string, title?: string) => {
    if (globalToastHandler) globalToastHandler({ type: "info", message, title });
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, message, title, duration = 4000 }: Omit<ToastMessage, "id">) => {
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
      const newToast: ToastMessage = { id, type, message, title, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((message: string, title?: string) => showToast({ type: "success", message, title }), [showToast]);
  const error = useCallback((message: string, title?: string) => showToast({ type: "error", message, title, duration: 6000 }), [showToast]);
  const warning = useCallback((message: string, title?: string) => showToast({ type: "warning", message, title }), [showToast]);
  const info = useCallback((message: string, title?: string) => showToast({ type: "info", message, title }), [showToast]);

  globalToastHandler = showToast;

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, removeToast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxWidth: "380px",
          width: "calc(100vw - 40px)",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const isSuccess = t.type === "success";
          const isError = t.type === "error";
          const isWarning = t.type === "warning";

          const bg = isSuccess
            ? "#064E3B"
            : isError
            ? "#7F1D1D"
            : isWarning
            ? "#78350F"
            : "#1E293B";
          const border = isSuccess
            ? "#10B981"
            : isError
            ? "#EF4444"
            : isWarning
            ? "#F59E0B"
            : "#3B82F6";
          const color = "#F8FAFC";

          return (
            <div
              key={t.id}
              style={{
                pointerEvents: "auto",
                background: bg,
                border: `1.5px solid ${border}`,
                color,
                borderRadius: "12px",
                padding: "12px 14px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                animation: "toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div style={{ flexShrink: 0, marginTop: "2px" }}>
                {isSuccess && <CheckCircle2 size={20} color="#34D399" />}
                {isError && <AlertCircle size={20} color="#FCA5A5" />}
                {isWarning && <AlertTriangle size={20} color="#FDE68A" />}
                {!isSuccess && !isError && !isWarning && <Info size={20} color="#93C5FD" />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {t.title && (
                  <div style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "2px" }}>
                    {t.title}
                  </div>
                )}
                <div style={{ fontSize: "12.5px", lineHeight: "1.4", wordBreak: "break-word" }}>
                  {t.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "4px",
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: (msg: Omit<ToastMessage, "id">) => toast.info(msg.message, msg.title),
      success: toast.success,
      error: toast.error,
      warning: toast.warning,
      info: toast.info,
      removeToast: () => {},
    };
  }
  return context;
}
