import { useState } from "react";
import PortalModal from "../PortalModal/PortalModal";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";

const MakeAdminModal = ({ participant, onClose }) => {
  const [role, setRole] = useState("tournament-admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!participant) return;
    setError("");
    try {
      const response = await portalFetch("/api/portal/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid: participant.pid,
          firstName: participant.firstName,
          lastName: participant.lastName,
          email: participant.email,
          phone: participant.phone,
          role,
          initialPassword: password,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || "Unable to create admin.");
        return;
      }
      onClose();
    } catch (err) {
      setError("Unable to create admin.");
    }
  };

  return (
    <PortalModal
      title="Make admin"
      onClose={onClose}
      actions={
        <>
          <button
            className="btn btn-outline-secondary"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="btn btn-primary" type="button" onClick={handleSubmit}>
            Create admin
          </button>
        </>
      }
    >
      <div className="mb-3">
        <label className="form-label" htmlFor="make-admin-role">
          Role
        </label>
        <select
          id="make-admin-role"
          className="form-select"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="super-admin">Super admin</option>
          <option value="tournament-admin">Tournament admin</option>
        </select>
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="make-admin-password">
          Initial password
        </label>
        <input
          id="make-admin-password"
          className="form-control"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
    </PortalModal>
  );
};

export default MakeAdminModal;
