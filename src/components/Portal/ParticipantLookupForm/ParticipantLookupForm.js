import { useState } from "react";
import styles from "./ParticipantLookupForm.module.scss";

const ParticipantLookupForm = ({ onSubmit, disabled = false }) => {
  const [value, setValue] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (onSubmit) {
      onSubmit(value);
    }
  };

  return (
    <section className={`${styles.ParticipantLookupForm}`}>
      <form onSubmit={handleSubmit} className="row g-3">
        <div className="col-12 col-md-8">
          <label className="form-label" htmlFor="participant-lookup">
            Email address
          </label>
          <input
            className="form-control"
            id="participant-lookup"
            type="email"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="you@example.com"
            disabled={disabled}
          />
        </div>
        <div className="col-12 col-md-4 d-flex align-items-end">
          <button className="btn btn-primary w-100" type="submit" disabled={disabled}>
            Send login link
          </button>
        </div>
      </form>
      <p className="mt-3 text-muted">
        We always show the same response to protect your privacy.
      </p>
    </section>
  );
};

export default ParticipantLookupForm;
