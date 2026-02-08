import { useState } from "react";
import styles from "./AdminLoginForm.module.scss";

const AdminLoginForm = ({ onSubmit, isSubmitting = false }) => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (onSubmit) {
      onSubmit({ email: identifier, password });
    }
  };

  return (
    <section className={`${styles.AdminLoginForm}`}>
      <form onSubmit={handleSubmit} className="row g-3">
        <div className="col-12">
          <label className="form-label" htmlFor="admin-identifier">
            Admin email or phone
          </label>
          <input
            className="form-control"
            id="admin-identifier"
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="admin@example.com or (555) 123-4567"
          />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="admin-password">
            Password
          </label>
          <input
            className="form-control"
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="col-12">
          <button className="btn btn-primary w-100" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
      <p className="mt-3 text-muted">
        Credentials are validated against the local admin table.
      </p>
    </section>
  );
};

export default AdminLoginForm;
