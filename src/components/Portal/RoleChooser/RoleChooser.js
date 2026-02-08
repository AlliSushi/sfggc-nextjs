import Link from "next/link";
import styles from "./RoleChooser.module.scss";

const RoleChooser = () => {
  return (
    <section className={`${styles.RoleChooser} row g-4`}>
      <div className="col-12">
        <div className={`${styles.Card} card`}>
          <div className="card-body">
            <h2 className="h4">Are you a participant?</h2>
            <div className="d-flex flex-column flex-sm-row gap-3 mt-3">
              <Link className="btn btn-primary" href="/portal/participant">
                Yes, I am
              </Link>
              <Link className="btn btn-outline-primary" href="/portal/admin">
                No, I'm not
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoleChooser;
