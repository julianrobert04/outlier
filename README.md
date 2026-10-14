# Outlier

**Football, seen differently.** Every NFL career since 2000, measured against what was expected of it.

- **Outlier Index (.01–.99)**: of everyone who started where a player started (recruiting stars when linked, otherwise draft slot), the share whose career turned out worse.
- **Expectation Gap**: actual career AV minus the AV that comparable picks (same position, same era, similar slot) produced.
- **Career DNA**: rule-based career paths, plus a "same path" finder.
- **Development Lab**: colleges ranked by how much their players beat their draft slot, with confidence intervals.
- **Debate Lab**: football arguments tested against the data.

## Run

```bash
npm install
npm run dev
```

## Data

All numbers come from public data. Nothing is entered by hand.

```bash
npm run data                                   # NFL outcomes (nflverse / Pro Football Reference)
CFBD_API_KEY=... npm run data:recruits         # + 247 composite recruiting ratings (free key: collegefootballdata.com/key)
```

A GitHub Action rebuilds the data every week. Methodology: see `/#/method` on the site.
