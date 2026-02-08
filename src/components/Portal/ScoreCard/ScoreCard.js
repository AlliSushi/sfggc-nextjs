import styles from "./ScoreCard.module.scss";

const ScoreCard = ({ label, scores = [] }) => {
  const game1 = scores[0] ?? null;
  const game2 = scores[1] ?? null;
  const game3 = scores[2] ?? null;
  const total =
    game1 != null && game2 != null && game3 != null
      ? game1 + game2 + game3
      : null;

  const display = (value) => (value != null ? value : "\u2014");

  return (
    <div className={styles.ScoreCard}>
      <h3 className="h6 mb-2">{label}</h3>
      <div className={styles.ScoreBoxes}>
        <div className={styles.ScoreBox}>
          <span className={styles.ScoreLabel}>Game 1</span>
          <span className={styles.ScoreValue}>{display(game1)}</span>
        </div>
        <div className={styles.ScoreBox}>
          <span className={styles.ScoreLabel}>Game 2</span>
          <span className={styles.ScoreValue}>{display(game2)}</span>
        </div>
        <div className={styles.ScoreBox}>
          <span className={styles.ScoreLabel}>Game 3</span>
          <span className={styles.ScoreValue}>{display(game3)}</span>
        </div>
        <div className={`${styles.ScoreBox} ${styles.TotalBox}`}>
          <span className={styles.ScoreLabel}>Total</span>
          <span className={styles.ScoreValue}>{display(total)}</span>
        </div>
      </div>
    </div>
  );
};

export default ScoreCard;
