export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let toastCallbacks: ((toast: Toast) => void)[] = [];

export const toastService = {
  subscribe: (callback: (toast: Toast) => void) => {
    toastCallbacks.push(callback);
    return () => {
      toastCallbacks = toastCallbacks.filter(cb => cb !== callback);
    };
  },

  show: (message: string, type: ToastType = 'info', duration: number = 3000) => {
    const toast: Toast = {
      id: `toast-${Date.now()}-${Math.random()}`,
      message,
      type,
      duration,
    };
    toastCallbacks.forEach(cb => cb(toast));
  },

  success: (message: string, duration?: number) => toastService.show(message, 'success', duration),
  error: (message: string, duration?: number) => toastService.show(message, 'error', duration),
  info: (message: string, duration?: number) => toastService.show(message, 'info', duration),
  warning: (message: string, duration?: number) => toastService.show(message, 'warning', duration),
};
