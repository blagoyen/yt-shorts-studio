import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useStudio } from "../stores/studio";

export function Toasts() {
  const toasts = useStudio((state) => state.toasts);
  const dismiss = useStudio((state) => state.dismissToast);

  return (
    <div className="toasts">
      {toasts.map((toast) => {
        const Icon = toast.tone === "error" ? AlertCircle : toast.tone === "success" ? CheckCircle2 : Info;
        return (
          <div key={toast.id} className={`toast ${toast.tone}`}>
            <Icon size={14} style={{ flex: "0 0 auto", marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div className="toast-message">{toast.message}</div>
              {toast.detail && <div className="toast-detail">{toast.detail}</div>}
            </div>
            <button className="icon-btn small" onClick={() => dismiss(toast.id)} title="Dismiss">
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
