import type { Dataset } from '../data'

export default function MethodPage({ data }: { data: Dataset }) {
  return (
    <div className="wrap" style={{ paddingTop: 56 }}>
      <h1 className="h1">How the<br />numbers work.</h1>
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
          {data.recruitingLinked ? `${data.recruitingLinked.toLocaleString()} players linked by name, school and years, from recruiting classes 2000–${data.model.lastClass}. Classes before about 2003 are thin in the source, so early careers are linked less often.` : 'not connected yet. When they are, the Outlier Index starts from high school.'}
        </p>
        <p>
          <strong>College stats</strong> (CollegeFootballData.com): regular-season passing, rushing, receiving, returns and kicking from about
          {' '}{data.coverage.college.offenseFrom}, defensive tackles, tackles for loss, sacks, hurries and passes defended from {data.coverage.college.defenseFrom}.
          {' '}{data.collegeLinked.toLocaleString()} players linked by name, school and years. There are no individual stats for offensive linemen.
          <strong> College production</strong> is a position-specific score from career college totals, shown as a percentile against every NFL
          player at the same position with college stats. It is context on the journey, not part of the Outlier Index.
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
          (2001–2012, counting only weeks the team played) or at least 50% of offensive or defensive snaps (2013+).
        </p>
        <p>
          <strong>Stuffs</strong> and <strong>run stops</strong> are computed from every regular-season running play since {data.model.firstClass}.
          A stuff is a tackle on a run that gained nothing or lost yards. A run stop is a tackle on a run the offense failed:
          under 40% of the needed yards on 1st down, under 60% on 2nd, short of the line to gain on 3rd or 4th. Every tackler on the play
          gets credit. Pressures, hurries, missed tackles, coverage allowed, broken tackles, yards before contact and drops come from
          Pro Football Reference’s advanced stats, which start in {data.coverage.advancedFrom}. College stats will be added with the recruiting data.
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
          One number from <strong>.01 to .99</strong> for the whole journey. It scores each stage we can measure as a percentile:
        </p>
        <p>
          The grade is a <strong>ladder of expectations</strong>. Every step is a multiplier: how many times the usual outcome the player got.
        </p>
        <p>
          <strong>1. Stars → draft.</strong> Draft value of the player’s slot, divided by the average draft value of every recruit with the same
          star rating and position from the same era, <em>including those who never reached the NFL</em> (worth zero). Draft value is the average
          career a pick at that slot produces. Rare ratings (5★s) widen the comparison window until at least 30 recruits are included.<br />
          <strong>2. Draft → career.</strong> NFL career value divided by what the player’s draft slot usually produces (see Expected value below).
        </p>
        <p>
          Combined: <span className="num">M = √(draft multiplier) × career multiplier</span>, with the career multiplier squared when it is below 1.
          The draft step counts half, the career fully, and a collapse twice. Without a star rating the draft step is ×1.
          The grade is <span className="num">M<sup>{data.model.gradeCurve}</sup> ÷ (M<sup>{data.model.gradeCurve}</sup> + 1)</span>, so .50 means exactly as expected and .99 takes
          roughly a 22× climb. Grades round down, and early careers are capped at {data.model.earlyCap.toFixed(2).replace(/^0/, '')} until they’ve run longer.
        </p>
        <p>
          <strong>3. How good the career was.</strong> The numbers count, not only expectations. Total career value (Pro Football Reference’s AV,
          built from the player’s stats) is ranked against everyone at the position who played since {data.model.firstClass}, and put on a steep scale
          (quality<sup>{data.model.qualityPower}</sup>): better than 90% of the position is .53, 99% is .94.
        </p>
        <p>
          <strong>Grade = √(ladder grade × career quality)</strong>: half climb, half career. Elite careers (top {Math.round((1 - data.model.eliteFrom) * 100)}% of a position)
          grade .95+ even when they were expected, and .99 is the top {Math.round((1 - data.model.eliteTop) * 1000) / 10}%, if the ladder didn’t collapse.
          Careers in progress are capped at {data.model.activeCap.toFixed(2).replace(/^0/, '')} because they can still go down.
          Bands: .99 legendary, .95+ great, .85+ very good, .70+ solid, .50+ as expected, .25+ below expectations, under .25 bust.
          {' '}{data.recruitingLinked.toLocaleString()} players are linked to a 247Sports Composite rating.
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
