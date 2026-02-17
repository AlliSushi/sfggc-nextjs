import Image from "next/image";

import styles from './ScrMstWinners.module.scss';

import a_winner from '../../images/scrmst-winners/SMA_TJ_Pettit.jpg';
import b_winner from '../../images/scrmst-winners/SMB_Gary_McNamara.jpg';
import c_winner from '../../images/scrmst-winners/SMC_Kells_Parker.jpg';
import d_winner from '../../images/scrmst-winners/SMD_Carlos_Castellanos.jpg';

const ScrMstWinners = () => {
  return (
    <section className={`${styles.ScrMstWinners}`} id={'contact'}>
      <h3 className={`section-heading`}>
        Scratch Masters Winners
      </h3>

      <div className={`${styles.Intro}`}>
        <p className={``}>
          Gallery of Winners 2026
        </p>
      </div>

      <div className={`row justify-content-center`}>
        <div className={`col-6 col-sm-4 col-lg-3`}>
          <div className={`card ${styles.Card}`}>
            <Image src={a_winner}
                   alt={'TJ Pettit'}
                   className={`img-fluid card-img-top ${styles.Image}`}
            />
            <div className={`card-body`}>
              <p className={`${styles.Name}`}>
                  TJ Pettit
              </p>
              <p className={styles.Role}>
                Division A Winner
              </p>
            </div>
          </div>

        </div>

        <div className={`col-6 col-sm-4 col-lg-3`}>
          <div className={`card ${styles.Card}`}>
            <Image src={b_winner}
                   alt={'Gary McNamara'}
                   className={`img-fluid card-img-top ${styles.Image}`}
            />
            <div className={`card-body`}>
              <p className={`${styles.Name}`}>
                  Gary McNamara
               </p>
              <p className={styles.Role}>
                Division B Winner
              </p>
            </div>
          </div>
        </div>

        <div className={`col-6 col-sm-4 col-lg-3`}>
          <div className={`card ${styles.Card}`}>
            <Image src={c_winner}
                   alt={'Kells Parker'}
                   className={`img-fluid card-img-top ${styles.Image}`}
            />
            <div className={`card-body`}>
              <p className={`${styles.Name}`}>
                  Kells Parker
              </p>
              <p className={styles.Role}>
                Division C Winner
              </p>
            </div>
          </div>
        </div>

        <div className={`col-6 col-sm-4 col-lg-3`}>
          <div className={`card ${styles.Card}`}>
            <Image src={d_winner}
                   alt={'Carlos Castellanos'}
                   className={`img-fluid card-img-top ${styles.Image}`}
            />
            <div className={`card-body`}>
              <p className={`${styles.Name}`}>
                  Carlos Castellanos
              </p>
              <p className={styles.Role}>
                Division D Winner
              </p>
            </div>
          </div>
        </div>
      </div>

    </section>
  )
}

export default ScrMstWinners;


