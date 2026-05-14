# Coverage Baselines — Frontend

Per-date snapshots of `npm run coverage:hydrata` output. Each dated folder
is a frozen reference point that ratchet decisions (60-day-deferred per
TASK-734 §2A) compare against.

## Why baselines exist

Without a recorded baseline, every threshold conversation becomes "what
number?" and gets stuck. The threshold ramp from §2A makes a `baseline +
5` per app at +30 days, `baseline + 15` at +90 days commitment — but only
**after 60 days of operational experience** confirms the ratchet schedule
fits the real test-evolution cadence.

The ratcheting decision is **deferred 60 days post-baseline**; there is
no auto-applied +30/+90 schedule today.

## How to re-baseline

```bash
cd /opt/geonode-mapstore-client/geonode_mapstore_client/client
npm run coverage              # full karma run, writes coverage/lcov.info
npm run coverage:hydrata      # filters to js/ records, writes coverage/lcov-hydrata.info

mkdir -p tests/baselines/$(date +%Y-%m-%d)
cp coverage/lcov-hydrata.info tests/baselines/$(date +%Y-%m-%d)/
```

Then commit and `git push origin 5.x`.

## Current baselines

### 2026-05-14 — initial baseline (TASK-734)

| Metric    | Hit / Found | %       |
|-----------|-------------|---------|
| Lines     | 4013 / 6628 | 60.5 %  |
| Branches  | 2279 / 4706 | 48.4 %  |
| Functions | 1132 / 2467 | 45.9 %  |
| Records   | 129 files   |         |

Captured at gmc `fd2af07a` after `npm run coverage` (1,692 tests passed,
6 marked slow) + `npm run coverage:hydrata` filter. MapStore2 files
excluded by `coverage:hydrata` filter; what remains is Hydrata-owned
`js/` sources only.

The filter regex was fixed in this same commit to match `^SF:(.*\/)?js\/`
instead of `^SF:.*\/js\/` — without leading-slash optionality, every
Hydrata file (`SF:js/...`) silently failed to match and `lcov-hydrata.info`
came out 0 records (this was the
"empty-records warn" follow-up from TASK-733's worklog).

#### Top 5 largest Hydrata files by line count

| File                                                          | Lines hit/found | %    |
|---------------------------------------------------------------|-----------------|------|
| `js/plugins/hydrata/Swamm/actionsSwamm.js`                    | 264 / 394       | 67 % |
| `js/utils/ResourceUtils.js`                                   | 198 / 349       | 57 % |
| `js/epics/gnresource.js`                                      | 38 / 228        | 17 % |
| `js/selectors/resource.js`                                    | 106 / 224       | 47 % |
| `js/plugins/hydrata/SimpleView/components/simpleViewMenuRow.js` | 140 / 197     | 71 % |

The 17 % cell on `js/epics/gnresource.js` is the highest-leverage place
for a coverage-add — large file, light coverage, central code path.

## AC notes (TASK-734)

- **AC5 (5/5 green CI literal):** at baseline time the
  `gh run list -R Hydrata/hydrata --workflow test.yml --limit 5` window
  contained 2 success + 3 failure. The 3 failures all pre-date the
  `c50fc19` CI fix; the 2 successes are consecutive post-fix
  (`c50fc19`, `06b9c64`). AC5 is **met in spirit, not in literal letter** —
  operator-decided (decision-request
  `2026-05-14-q-1-task-734-baselines-blocked.html`, option A: ship now
  with footnote, MEDIUM confidence). Three more green pushes accruing
  naturally from this session's ship sequence (README badge, baselines,
  test-nightly rewrite) will satisfy the literal check.
- **AC4 (`apps/projects` excluded):** N/A for frontend — this AC applies
  to backend `pyproject.toml [tool.coverage.run] omit`. The frontend
  filter excludes MapStore2 wholesale; Hydrata-owned `js/` is fully
  in-scope.
