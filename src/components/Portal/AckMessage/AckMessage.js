import styles from "./AckMessage.module.scss";

const AckMessage = ({ title, message, note }) => {
  return (
    <section className={`${styles.AckMessage} card`}>
      <div className="card-body">
        <h2 className="h4">{title}</h2>
        <p>{message}</p>
        {note && <p className="text-muted mb-0">{note}</p>}
      </div>
    </section>
  );
};

export default AckMessage;
