import { useEffect, useRef, useId, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
const returnTargets = new WeakMap<HTMLDialogElement, HTMLElement>();
export default function Modal({
  title,
  children,
  onClose,
  dirty = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dirty?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const active = document.activeElement as HTMLElement;
  const parentDialog = active?.closest('dialog');
  const returnFocus = useRef(parentDialog ? returnTargets.get(parentDialog) : active);
  const editingFocus = useRef<HTMLElement | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  function requestClose() {
    if (dirty) {
      editingFocus.current = document.activeElement as HTMLElement;
      setConfirmClose(true);
    } else onClose();
  }
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && returnFocus.current) returnTargets.set(dialog, returnFocus.current);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    const viewport = window.visualViewport;
    const resize = () => {
      if (!viewport) return;
      ref.current?.style.setProperty('--dialog-visible-height', `${viewport.height}px`);
      ref.current?.style.setProperty(
        '--dialog-center',
        `${viewport.offsetTop + viewport.height / 2}px`,
      );
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      dialog?.close();
      document.body.style.overflow = overflow;
      requestAnimationFrame(() => {
        if (returnFocus.current?.isConnected && !document.querySelector('dialog[open]'))
          returnFocus.current.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) requestClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button aria-label="Close dialog" className="icon-button" onClick={requestClose}>
          <X size={22} />
        </button>
      </div>
      {confirmClose && (
        <div className="notice" role="alert">
          <p>You have unsaved changes. Keep editing or discard this draft?</p>
          <div className="button-row">
            <button
              type="button"
              className="primary"
              autoFocus
              onClick={() => {
                setConfirmClose(false);
                requestAnimationFrame(() => editingFocus.current?.focus({ preventScroll: true }));
              }}
            >
              Keep editing
            </button>
            <button type="button" className="danger" onClick={onClose}>
              Discard draft
            </button>
          </div>
        </div>
      )}
      {children}
    </dialog>
  );
}
