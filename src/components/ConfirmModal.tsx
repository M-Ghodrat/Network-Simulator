import React from "react";
import { AlertTriangle, Info, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "info" | "success";
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "info",
  showCancel = true,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getColorClasses = () => {
    switch (type) {
      case "danger":
        return {
          icon: <AlertTriangle className="text-rose-600 w-5 h-5" />,
          bg: "bg-rose-50 border-rose-100",
          btn: "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 text-white"
        };
      case "success":
        return {
          icon: <Info className="text-emerald-600 w-5 h-5" />,
          bg: "bg-emerald-50 border-emerald-100",
          btn: "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white"
        };
      default:
        return {
          icon: <Info className="text-indigo-600 w-5 h-5" />,
          bg: "bg-indigo-50 border-indigo-100",
          btn: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-white"
        };
    }
  };

  const classes = getColorClasses();

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="confirm-modal-overlay">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden p-6 relative space-y-4 animate-scale-in"
        id="confirm-modal-card"
      >
        {showCancel && onCancel && (
          <button 
            onClick={onCancel}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-50"
          >
            <X size={16} />
          </button>
        )}

        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl border ${classes.bg} shrink-0`}>
            {classes.icon}
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 font-sans">{title}</h3>
            <p className="text-slate-500 text-xs leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          {showCancel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm ${classes.btn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
