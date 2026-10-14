import type { Dataset } from '../data'

export default function MethodPage({ data }: { data: Dataset }) {
  return (
    <div className="wrap" style={{ paddingTop: 56 }}>
      <div className="kicker"><b>05</b> Method</div>
      <h1 className="h1" style={{ marginTop: 16 }}>How the<br />numbers work.</h1>
      <p className="lede" style={{ marginTop: 20 }}>No black boxes. Every number on Outlier comes from the rules on this page and the public data below.</p>

      <Block t="Data">
        <p>
          <strong>Players:</strong> everyone who entered the NFL from {data.model.firstClass} to {data.model.lastClass}, drafted or not:
          {' '}{data.players.length.toLocaleString()} players ({data.players.filter(p => !p.pick).length.toLocaleString()} undrafted). Everything comes from the open{' '}
          <a href="https://github.com/nflverse/nflverse-data" style={{ textDecoration: 'underline' }}>nflverse</a> project: draft picks with
          Pro Football Reference career data, the player registry, season stats, depth charts (2001–11) and snap counts (2012+). The dataset was last rebuilt on {new Date(data.generated).toLocaleDateString('en-US', { dateStyle: 'long' })}.
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

      <Block t="Undrafted players">
        <p>
          Pro Football Reference’s AV is only published with draft data, so undrafted players get an <strong>estimated AV</strong>, marked
          with an asterisk. A regression for each position group learns how games, starts, seasons and position stats turn into AV for
          drafted players whose real AV we know, then applies it to undrafted players. Fit (R²) by group:{' '}
          {Object.entries(data.model.avModel).map(([g, m]) => `${g} ${m.r2.toFixed(2)}`).join(' · ')}.
        </p>
        <p>Undrafted players are compared with other undrafted players from nearby classes, since there is no draft slot to compare against.
          Pro Bowl and All-Pro honors aren’t in the source data for them yet.</p>
      </Block>

      <Block t="Early careers">
        <p>
          Players from the <strong>{data.model.youngFrom}–{data.model.lastClass}</strong> classes have only a few seasons behind them, so they get their own track.
          They are compared on <strong>pace</strong>: career value per season so far, with the current season counting as a fraction. The comparison group
          is every other young player at their position drafted near the same slot. Their Outlier Index is an <em>early read</em>, and their pages carry
          accolades a short career can already earn: Pro Bowls, class rank, day-one starter, steal of the class.
        </p>
      </Block>

      <Block t="Season stats">
        <p>
          Season-by-season tables use nflverse regular-season stats. <strong>Games started</strong> means first string on the weekly depth chart
          (2001–2011) or at least 50% of offensive or defensive snaps (2012+). College stats will be added with the recruiting data.
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
          length. Classes after {data.model.lastJudgedClass} use the early-career track above. If a comparison group is smaller than
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
        <p>Undrafted players’ value is estimated, and the registry is less complete for undrafted players who never reached a game-day roster in the early 2000s. AV is an approximation and favors positions with box-score stats. Active careers can still change in either direction.</p>
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
