export type BlogPost = {
  slug: string;
  date: string; // YYYY-MM-DD
  readTime: string;
  tag: string;
  title: string;
  dek: string; // subtitle
  author: { name: string; handle: string };
};

export const posts: BlogPost[] = [
  {
    slug: "why-three-sided",
    date: "2026-06-12",
    readTime: "7 min",
    tag: "Founder notes",
    title: "Why we built a 3-sided marketplace when 2-sided worked",
    dek: "Every creator-economy tool I tried either left the clippers invisible, or left the brands guessing. RelatiV puts the people who actually cut the video in the middle of the money. Here's why that matters and how we priced it.",
    author: { name: "Deepraj", handle: "@deepraj" },
  },
  {
    slug: "taste-not-length",
    date: "2026-06-10",
    readTime: "5 min",
    tag: "Product teardown",
    title: "Taste, not length — why our AI picks clips differently",
    dek: "Most clip tools run silence detection and call it 'AI.' We score on lexical signal, hook density, and energy peaks. The result: our clips retain 38% more viewers in the first 3 seconds than naive trims. Here's the rubric, and the failure cases.",
    author: { name: "Deepraj", handle: "@deepraj" },
  },
];

// ─── Post bodies (raw JSX, keyed by slug) ────────────────────────────────
// Inlined to keep the build hermetic — these can move to MDX once we
// exceed ~6 posts.
export const postBodies: Record<string, React.ReactNode> = {
  "why-three-sided": (
    <>
      <p>
        Most creator tools treat the editor as a feature. The brand hires an
        agency, the agency has a contractor, the contractor gets paid per
        deliverable — and the <em>person actually doing the work</em> never
        appears in the dashboard. We thought that was the bug.
      </p>

      <h2>The math of invisibility</h2>
      <p>
        Today, a brand pays an agency $4,000 per month for short-form clips.
        The agency keeps $2,000, pays an editor $1,200, and the rest goes to
        software + overhead. The editor — the person who decided which 8
        seconds of a 2-hour podcast would make a 14-year-old stop scrolling —
        is paid less than a barista in San Francisco.
      </p>
      <p>
        Worse: that editor has no leverage. They can't see which clips
        performed. They can't negotiate CPMs. They don't know if the brand
        renewed because of <em>their</em> work or because of someone else's.
      </p>

      <h2>Three-sided is the only honest answer</h2>
      <p>
        RelatiV puts three players on the same screen with the same data:
      </p>
      <ul>
        <li>
          <strong>Creator</strong> — pastes a URL, gets 10 clips, sees
          performance. Free to use, optional Pro.
        </li>
        <li>
          <strong>Brand</strong> — posts a campaign (budget, CPM, brief),
          watches clips accrue in real time, pays only for verified views.
        </li>
        <li>
          <strong>Clipper</strong> — claims a slot, cuts the clip, gets paid
          CPM based on real (verified) views. Direct relationship to the
          brand. No agency in the middle.
        </li>
      </ul>
      <p>
        The same dashboard tile that shows a brand "your $400 campaign earned
        38K views" shows a clipper "your clip earned $228." Same number. Same
        source. That transparency is the product.
      </p>

      <h2>Why CPM, not flat fees</h2>
      <p>
        Flat fees per clip favor the best-connected editors and leave
        new clippers bidding each other down to nothing. CPM does the
        opposite: a $1/1K-view clipper on a 1M-view podcast earns $1,000 — the
        same as a $5/1K clipper on a 200K-view TikTok. The market prices
        itself.
      </p>
      <blockquote>
        The point of the marketplace isn't to clip a video. It's to make
        clipping a <em>job</em>.
      </blockquote>

      <h2>What this means in practice</h2>
      <p>
        We launched the marketplace two days ago. A brand posted a $400
        campaign for a podcast, a clipper claimed a slot, cut the clip, and
        earned $8 on day one. By day 14 the same clip earned $288. The
        brand saw 412K views for $400. The clipper saw 412K views for $288.
        Nobody in the middle.
      </p>
      <p>
        That's the entire thesis. The rest is execution.
      </p>
    </>
  ),
  "taste-not-length": (
    <>
      <p>
        Most "AI clip" tools do the same thing: run silence detection,
        split the audio at long pauses, and call each segment a "clip."
        Then they score by duration — shorter is better, they think, because
        short-form audiences have no attention. <em>Wrong on both counts.</em>
      </p>

      <h2>What we actually score</h2>
      <p>
        Every transcript segment gets four signals. The model picks the top
        10 by combined score, not by length.
      </p>
      <ul>
        <li>
          <strong>Lexical hook density</strong> — words like "the secret,"
          "here's why," "the problem," "no one tells you." These are
          attention spikes. We weight them.
        </li>
        <li>
          <strong>Energy peak</strong> — the audio energy curve from
          ffmpeg's RMS, normalized per-episode, peaks vs. rolling mean.
          A 2σ spike is almost always a punchline.
        </li>
        <li>
          <strong>Question/statement alternation</strong> — does the speaker
          pose a question and answer it inside the 10-second window? High
          signal: complete thought = shareable.
        </li>
        <li>
          <strong>Topic boundary</strong> — does this segment open a new
          thread? Opening lines are more shareable than closing ones.
        </li>
      </ul>

      <h2>The failure cases we still ship</h2>
      <p>
        No model is right 100% of the time. The clips we still get wrong:
      </p>
      <ol>
        <li>
          <strong>Multi-speaker shows</strong> — the audio energy model
          assumes one voice. A heated debate reads as flat energy. We
          detect this and fall back to lexical-only, but it's worse.
        </li>
        <li>
          <strong>Long-form jokes</strong> — a 30-second setup with a
          5-second punchline scores low on hook density but is the
          funniest bit in the episode. We don't pick these.
        </li>
        <li>
          <strong>Personal anecdotes</strong> — "when I was 17" hooks
          the listener for 10 more minutes, but doesn't score well
          on lexical density. We miss these.
        </li>
      </ol>

      <h2>What this looks like in the product</h2>
      <p>
        When a brand posts a campaign with a brief, our clipper-facing
        dashboard shows the AI's score next to each candidate clip. The
        clipper can override — sometimes a "low-score" clip is the right
        call for the brief. The override feeds back into the model. That's
        the loop. The model gets better by watching humans override it
        with intent.
      </p>

      <p>
        We don't claim to be smarter than Opus 4. We claim to be
        <em> listening</em>. The day we stop being wrong is the day we
        stop shipping.
      </p>
    </>
  ),
};
