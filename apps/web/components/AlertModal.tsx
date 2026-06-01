"use client";

type AlertModalProps = {
  title: string;
  message: string;
  onClose: () => void;
};

export function AlertModal({ title, message, onClose }: AlertModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal--alert"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        aria-describedby="alert-modal-message"
      >
        <div className="modal__content">
          <h3 id="alert-modal-title" className="alert-modal__title">
            {title}
          </h3>
          <p id="alert-modal-message" className="alert-modal__message">
            {message}
          </p>
          <button type="button" className="btn btn--primary alert-modal__ok" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
