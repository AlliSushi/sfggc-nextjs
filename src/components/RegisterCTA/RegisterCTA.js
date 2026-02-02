import styles from './RegisterCTA.module.scss';

const REGISTER_URL = 'https://go.signmeup.io/?eventid=51';

const RegisterCTA = ({ isOpen }) => (
  <div className={styles.RegisterCTA}>
    <p className={'my-5'}>
      {isOpen ? (
        <a href={REGISTER_URL} className={`btn btn-lg btn-success`}>
        Register Online
        </a>
      ) : (
        <button className="btn btn-lg btn-success" disabled>
          Registration Closed
        </button>
      )}
    </p>
  </div>
)

export default RegisterCTA;
