import Image from "next/image";
import styles from "./FloatingAirship.module.css";

export default function FloatingAirship() {
  return (
    <div className={styles.flight}>
      <Image
        className={styles.airship}
        src="/own-your-taste-airship.png"
        alt="Own Your Taste"
        width={1000}
        height={360}
        sizes="(min-width: 1450px) 480px, (min-width: 670px) 33vw, 220px"
        unoptimized
      />
    </div>
  );
}
