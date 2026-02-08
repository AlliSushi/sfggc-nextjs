import styles from "./PortalModal.module.scss";

const PortalModal = ({ title, children, actions, onClose }) => {
  return (
    <div className={styles.Backdrop} role="presentation">
      <div className={`modal d-block`} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            <div className="modal-footer">{actions}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalModal;
