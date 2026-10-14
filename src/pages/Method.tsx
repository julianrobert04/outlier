import type { Dataset } from '../data'

export default function MethodPage({ data }: { data: Dataset }) {
  return (
    <div className="wrap" style={{ paddingTop: 56 }}>
      <div className="kicker"><b>05</b> Method</div>
      <h1 className="h1" style={{ marginTop: 16 }}>How the<br />numbers work.</h1>
      <p className="lede" style={{ marginTop: 20 }}>No black boxes. Every number on Outlier comes from the rules on this page and the public data below.</p>

      <Block t="Data">
        <p>
          <strong>NFL outcomes:</strong> every NFL draft pick from 2000 onward, from the open{' '}
          <a href="https://github.com/nflverse/nflverse-data" style={{ textDecoration: 'underline' }}>nflverse</a> project, which carries
          Pro Football Reference career data. The dataset was last rebuilt on {new Date(data.generated).toLocaleDateString('en-US', { dateStyle: 'long' })}.
        </p>
        <p>
          <strong>Career value</strong> is Pro Football Reference’s weighted Approximate Value (AV), the one measure that compares a
          guard with a quarterback. It weights a player’s best seasons most heavily. A player who never played has 0.
        </p>
        <p>
          <strong>Recruiting ratings</strong> (247Sports composite, via CollegeFootballData.com):{' '}
          {data.recruitingLinked ? `${data.recruitingLinked.toLocaleString()} players linked.` : 'not connected yet. When they are, the Outlier Index starts from high school.'}
        </p>
      </Block>

      <Block t="Expected value">
        <p>
          For each player we build a comparison group: players at the <strong>same position group</strong>, from <strong>nearby draft
          classes</strong>, weighted by how close their pick was, measured on a log scale, so #1 vs #5 counts as a bigger gap than #101 vs #105.
          The weighted average of their career AV is the player’s <strong>expected AV</strong>.
        </p>
        <p>
          Recent classes are only compared with classes of the <strong>same age</strong>, so a 2022 pick is judged against careers of the same
          length. Classes after {data.model.lastJudgedClass} are left out because their careers are too young to judge. If a comparison group is smaller than
          {' '}{data.model.minPeers} effective players, the window widens. Players whose group stays thin are flagged on their page.
        </p>
        <p><strong>Gap</strong> = actual AV − expected AV. <strong>Percentile</strong> = the weighted share of comparable picks this player outplayed.</p>
      </Block>

      <Block t="Outlier Index">
        <p>
          One number from <strong>.01 to .99</strong>: of everyone who started where this player started, the share whose career turned out
          worse. It is measured from the <strong>earliest stage available</strong>. When a recruiting rating is linked, the group is every recruit
          with the same star rating, position and era, <em>including those who never reached the NFL</em>. That is why a 2-star who reaches the Hall of Fame
          is a .99, and a 5-star who never plays a down falls near .01. Without a recruiting rating, the group is comparable draft picks.
        </p>
      </Block>

      <Block t="Career DNA">
        <p>
          Paths are assigned by plain rules, checked in order (see the Career DNA page). “Same path” uses a six-part career fingerprint:
          draft slot, percentile against peers, career length, peak (Pro Bowls plus double-weighted All-Pros), starting rate, and the share of value earned for
          the drafting team. The closest fingerprints are the most similar careers.
        </p>
      </Block>

      <Block t="Development Lab">
        <p>
          A college’s score is the average gap of the players it sent to the draft, pulled toward zero for small samples (as if every school
          had 15 extra average players). Because the draft slot already prices in how good a player looked at the draft, this isolates
          what happened <em>after</em> the draft. It does not yet separate college coaching from player traits. That needs recruiting-adjusted inputs,
          which come next.
        </p>
      </Block>

      <Block t="Known limits">
        <p>Undrafted players aren’t in the dataset yet, so some of the greatest outliers are missing. AV is an approximation and favors positions with box-score stats. Active careers can still change in either direction.</p>
      </Block>
    </div>
  )
}

function Block({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <section className="section" style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 2fr', gap: 32 }}>
      <h2 className="h2">{t}</h2>
      <div className="prose">{children}</div>
    </section>
  )
}
