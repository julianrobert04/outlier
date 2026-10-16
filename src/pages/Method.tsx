import type { Dataset } from '../data'

export default function MethodPage({ data }: { data: Dataset }) {
  return (
    <div className="wrap" style={{ paddingTop: 56 }}>
      <h1 className="h1">How the<br />numbers work.</h1>
      <p className="lede" style={{ marginTop: 20 }}>No black boxes. Every number on Outlier comes from the rules on this page and the public data below.</p>

      <Block t="Data">
        <p>
          <strong>Players:</strong> every drafted player from {data.model.firstClass} to {data.model.lastClass}, plus undrafted players with NFL season stats (1999 on):
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
          <strong>Stuffs</strong> and <strong>run stops</strong> are computed from every regular-season running play since {data.model.recruitingFrom}.
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
        <p><strong>Difference</strong> = his AV − the usual AV for his pick. <strong>Percentile</strong> = the weighted share of comparable picks this player outplayed.</p>
      </Block>

      <Block t="Outlier Index">
        <p>
          One number from <strong>.01 to .99</strong> for the whole journey. It scores each stage we can measure as a percentile:
        </p>
        <p>
          Expectations are measured as multipliers: how many times the usual outcome the player got.
        </p>
        <p>
          <strong>1. Stars → draft.</strong> Draft value of the player’s slot, divided by the average draft value of every recruit with the same
          star rating and position from the same era, <em>including those who never reached the NFL</em> (worth zero). Draft value is the average
          career a pick at that slot produces. Rare ratings (5★s) widen the comparison window until at least 30 recruits are included.<br />
          <strong>2. Draft → career.</strong> NFL career value divided by what the player’s draft slot usually produces (see Expected value below).
        </p>
        <p>
          These multipliers measure the <em>climb</em>: climb = √(draft multiplier) × career multiplier. Without a star rating the draft step is ×1.</p>
        <p>
          <strong>3. How good the career was.</strong> The numbers count, not only expectations. Total career value (Pro Football Reference’s AV,
          built from the player’s stats) plus <strong>honor points on a scale of prestige</strong>: MVP {data.honorPoints.mvp}, Offensive or Defensive Player of the Year
          {' '}{data.honorPoints.opoy}, Hall of Fame {data.honorPoints.hof}, Super Bowl MVP {data.honorPoints.sbmvp}, first-team All-Pro {data.honorPoints.ap1}, Rookie of the Year {data.honorPoints.oroy},
          second-team All-Pro {data.honorPoints.ap2}, Comeback Player {data.honorPoints.comeback}, Pro Bowl {data.honorPoints.pb} (a popularity vote, so it counts least).
          Awards, All-Pro teams and undrafted players’ Pro Bowls come from Wikipedia’s season pages; drafted players’ Pro Bowl and All-Pro counts from
          Pro Football Reference. The total is ranked against everyone at the position who played since {data.model.firstClass}, and put on a steep scale
 to become the career-quality percentile.
        </p>
        <p>
          <strong>Career quality is balanced three ways</strong> so that lasting a long time isn’t enough on its own: peak (35%, how his best
          three seasons ranked at his position by production that year), elite seasons (35%, top-10 and top-20 finishes at his position) and total
          (30%, career value plus honor points). Season production uses published, standard formulas rather than weights we picked: ANY/A’s weights for quarterbacks
          (passing TD = 20 yards, interception = −45 yards, from Pro Football Reference’s Adjusted Net Yards per Attempt) with rushing on standard scoring;
          standard scoring for runners and receivers (TD = 60 yards, lost fumble = −20); standard IDP scoring for every defender (solo tackle 1, assist 0.5,
          sack 2, tackle for loss 1, interception 3, forced fumble 2, fumble recovery 2, pass defended 1, safety 2, touchdown 6). Corners and safeties are
          ranked only against their own kind (from where they lined up on weekly depth charts), and because box scores can’t see coverage, a defensive back’s
          career value plus honors carries half of his career quality. Offensive linemen have no individual production stats, so theirs is 30% seasons as a primary starter, 20% best second contract
          (average per year as a share of the salary cap, compared within the same line spot, since centers are paid less than tackles; OverTheCap data via
          nflverse, deals signed through 2022) and 50% career value plus honors, where All-Pro teams are the clearest public judgment of a lineman.
          When a player’s contract history isn’t known, that part is left out rather than scored zero. Specialists use the total only.
          A Hall of Famer never grades below {data.model.hofFloor.toFixed(2).replace(/^0/, '')}: induction is the sport’s own judgment of a career, even one cut short by injury.
        </p>
        <p>
          <strong>Grade: career first, expectations second.</strong> The career-quality percentile sets the base on a fixed scale
          (80th percentile → .50, 90th → .62, 95th → .74, 98th → .88, top 0.5% → .99). A climb above expectations lifts it
          up to {Math.round(data.model.climbShare * 100)}% of the way to .99, scaled by career quality, so a climb only counts as much as the career was good. A career below its draft slot multiplies it by
          career multiplier<sup>expected value ÷ {data.model.bustScale}</sup>, so a #1 pick who flames out falls to .01 while a late pick who barely
          played loses little. Careers in progress are capped at {data.model.activeCap.toFixed(2).replace(/^0/, '')} because they can still go down.
          Bands: .99 legendary, .95+ great, .85+ very good, .70+ solid, .50+ average, .25+ below average, under .25 bust.</p>
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
        <p>Season-by-season stats from nflverse start in {data.model.statsFrom}. Earlier NFL seasons, and college seasons CollegeFootballData.com doesn’t cover,
          come from the season tables on players’ Wikipedia pages (CC BY-SA), found through Wikidata’s link to Pro Football Reference IDs and marked “W”.
          Where both sources overlap (1999+), Wikipedia’s yards, touchdowns and interceptions agree with nflverse 96–99% of the time.
          Pages without stat tables leave those seasons empty: earlier seasons of older careers count in career value and honors but don’t appear in the season tables. High-school ratings start with the {data.model.recruitingFrom} class, so older players are graded from the draft step. Undrafted players’ value is estimated, and the registry is less complete for undrafted players who never reached a game-day roster in the early 2000s. AV is an approximation and favors positions with box-score stats. Active careers can still change in either direction.</p>
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
