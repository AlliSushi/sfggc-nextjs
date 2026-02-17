import Image from "next/image";

import styles from './ScrMstWinners.module.scss';

import divisionAImage from '../../images/scrmst-winners/SMA_TJ_Pettit.jpg';
import divisionBImage from '../../images/scrmst-winners/SMB_Gary_McNamara.jpg';
import divisionCImage from '../../images/scrmst-winners/SMC_Kells_Parker.jpg';
import divisionDImage from '../../images/scrmst-winners/SMD_Carlos_Castellanos.jpg';

const winners = [
  { image: divisionAImage, name: 'TJ Pettit', division: 'A' },
  { image: divisionBImage, name: 'Gary McNamara', division: 'B' },
  { image: divisionCImage, name: 'Kells Parker', division: 'C' },
  { image: divisionDImage, name: 'Carlos Castellanos', division: 'D' },
];

const ScrMstWinners = () => {
  return (
    <section className={`${styles.ScrMstWinners}`} id={'contact'}>
      <h3 className={`section-heading`}>
        Scratch Masters Winners
      </h3>

      <div className={`${styles.Intro}`}>
        <p>
          Gallery of Winners 2026
        </p>
      </div>

      <div className={`row justify-content-center`}>
        {winners.map(({ image, name, division }) => (
          <div className={`col-6 col-sm-4 col-lg-3`} key={division}>
            <div className={`card ${styles.Card}`}>
              <Image src={image}
                     alt={name}
                     className={`img-fluid card-img-top ${styles.Image}`}
              />
              <div className={`card-body`}>
                <p className={styles.Name}>{name}</p>
                <p className={styles.Role}>Division {division} Winner</p>
              </div>
            </div>
          </div>
        ))}
      </div>

    </section>
  )
}

export default ScrMstWinners;

