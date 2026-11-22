import Image from "next/image";
import { ArrowDownToLine, ArrowUpRight, Captions, Clock3, Heart, Play, Scissors } from "lucide-react";
import styles from "./CreatorProof.module.css";

const VIEW_BARS = [24, 36, 28, 49, 43, 62, 54, 76, 68, 91, 82, 100];

export default function CreatorProof() {
  return (
    <section className={styles.section} aria-labelledby="creator-results-title" data-creator-results>
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id="creator-results-title">Built for creators who want to <em>grow faster.</em></h2>
          <p>Turn long videos into short clips made for the feed.</p>
        </header>

        <div className={styles.grid} data-clip-first-stats>
          <article className={`${styles.card} ${styles.views}`}>
            <h3><Play size={16} aria-hidden="true" /> Short-form views</h3>
            <p className={styles.metric}>150K+</p>
            <p>Across TikTok, Reels &amp; Shorts</p>
            <div className={styles.bars} aria-hidden="true">
              {VIEW_BARS.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
            </div>
          </article>

          <figure className={`${styles.card} ${styles.showcase}`}>
            <div className={styles.collage} aria-hidden="true">
              <div className={`${styles.frame} ${styles.frameLeft}`}>
                <Image src="/thumb_r3.webp" alt="" fill sizes="(max-width: 600px) 24vw, 150px" />
              </div>
              <div className={`${styles.frame} ${styles.frameRight}`}>
                <Image src="/thumb_l3.webp" alt="" fill sizes="(max-width: 600px) 24vw, 150px" />
              </div>
              <div className={`${styles.frame} ${styles.frameFront}`}>
                <Image src="/thumb_l4.webp" alt="" fill sizes="(max-width: 600px) 30vw, 180px" />
              </div>
              <span className={styles.reaction}><Heart size={20} fill="currentColor" /></span>
              <span className={styles.clipFormat}>9:16</span>
            </div>
            <figcaption>Made for the feed</figcaption>
          </figure>

          <article className={`${styles.card} ${styles.reach}`}>
            <h3><ArrowUpRight size={17} aria-hidden="true" /> Average reach increase</h3>
            <p className={styles.metric}>+266%</p>
            <p>For long-form creators, first 12 weeks</p>
            <svg className={styles.trend} viewBox="0 0 240 56" aria-hidden="true">
              <path d="M2 50 C27 51 29 30 54 32 S82 43 104 32 S129 14 154 19 S182 25 201 13 S222 9 238 3" />
            </svg>
          </article>

          <article className={`${styles.card} ${styles.turnaround}`}>
            <h3><Clock3 size={16} aria-hidden="true" /> Average turnaround</h3>
            <p className={styles.metric}>60s</p>
            <p>From YouTube link to 10 clips</p>
          </article>

          <article className={`${styles.card} ${styles.accuracy}`}>
            <h3><Captions size={17} aria-hidden="true" /> Caption accuracy</h3>
            <p className={styles.metric}>98.4%</p>
            <div className={styles.captionSample} aria-hidden="true">Make every <strong>word</strong> count.</div>
            <p>Powered by Whisper AI</p>
          </article>
        </div>

        <div className={styles.footer}>
          <p><Scissors size={17} aria-hidden="true" /><span><strong>10 of 47</strong> moments picked</span></p>
          <p><ArrowDownToLine size={17} aria-hidden="true" /><span><strong>9:16</strong> H.264 export</span></p>
          <a href="#homepage-hero">Start with 60 minutes free <ArrowUpRight size={17} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
