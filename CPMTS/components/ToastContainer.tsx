import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { Toast } from '../services/toastService';

interface ToastDisplayProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastDisplay: React.FC<ToastDisplayProps> = ({ toast, onRemove }) => {
  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const icons = {
    success: <CheckCircle size={20} className="text-green-600" />,
    error: <AlertCircle size={20} className="text-red-600" />,
    info: <Info size={20} className="text-blue-600" />,
    warning: <AlertTriangle size={20} className="text-yellow-600" />,
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200',
  };

  const textColors = {
    success: 'text-green-800',
    error: 'text-red-800',
    info: 'text-blue-800',
    warning: 'text-yellow-800',
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bgColors[toast.type]} animate-slide-in shadow-lg`}
    >
      {icons[toast.type]}
      <span className={`font-semibold text-sm ${textColors[toast.type]} flex-1`}>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 hover:bg-white/50 rounded-lg transition-all"
      >
        <X size={16} className={textColors[toast.type]} />
      </button>
    </div>
  );
};

interface ToastContainerProps {}

const ToastContainer: React.FC<ToastContainerProps> = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    // Import dynamically to avoid circular dependencies
    import('../services/toastService').then(({ toastService }) => {
      unsubscribe = toastService.subscribe((newToast: Toast) => {
        setToasts((prev) => [...prev, newToast]);
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastDisplay toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
