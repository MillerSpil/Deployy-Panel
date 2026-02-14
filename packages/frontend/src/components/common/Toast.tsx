import { useToast } from '@/hooks/useToast';
import type { Toast as ToastType } from '@/contexts/ToastContext';

const STYLES: Record<ToastType['type'], string> = {
  success: 'bg-green-900/90 border-green-500 text-green-300',
  error: 'bg-red-900/90 border-red-500 text-red-300',
  info: 'bg-slate-800/90 border-slate-500 text-slate-300',
};

function ToastItem({ toast }: { toast: ToastType }) {
  const { removeToast } = useToast();

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg ${STYLES[toast.type]}`}>
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"
      >
        &times;
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
