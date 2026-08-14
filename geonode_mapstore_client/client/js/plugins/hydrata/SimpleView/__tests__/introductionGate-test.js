/**
 * THE LANDING-INTERRUPT ORDERING CONTRACT, under test (epic 2765 W3).
 *
 * TASK-2776 AC1 requires the ordering to be proven by an automated test rather
 * than observed by hand, because a modal-ordering bug of this shape is
 * invisible in dev — where you are logged in, a member, and past the paywall —
 * and lands on exactly the anonymous link-recipient the epic exists to serve.
 *
 * Also covers TASK-2774's member/accept rules and TASK-2777's ANUGA-context
 * gate, because all three are clauses of the SAME guard and testing them apart
 * would let the file that owns the contract be green while the contract is not.
 */
import expect from 'expect';
import {
    INTRODUCTION_SHOW,
    INTRODUCTION_WAIT,
    INTRODUCTION_SUPPRESS,
    introductionVerdict,
    introductionVerdictFor,
    isAnugaContext,
    isPaywallArmed,
    isPaywallBlocking,
    isIntroductionProjectMember,
    hasAcceptedCurrentIntroduction
} from '../introductionGate';

// A non-member anonymous viewer on an ANUGA map who has not accepted: the one
// combination that should SHOW. Every case below is this, with one thing moved.
const ELIGIBLE = {
    anugaContext: true,
    loggedIn: false,
    roleResolved: false,
    paywallBlocking: false,
    payloadLoaded: true,
    isMember: false,
    hasAccepted: false
};

const VERSION_A = 'a'.repeat(64);
const VERSION_B = 'b'.repeat(64);

describe('introductionVerdict — the ordering contract (TASK-2776)', () => {
    it('SHOWS for the eligible case, so every negative below means something', () => {
        expect(introductionVerdict(ELIGIBLE)).toBe(INTRODUCTION_SHOW);
    });

    describe('1. authentication resolves FIRST', () => {
        it('WAITs while a logged-in viewer role is unresolved — neither modal shows', () => {
            expect(introductionVerdict({
                ...ELIGIBLE, loggedIn: true, roleResolved: false
            })).toBe(INTRODUCTION_WAIT);
        });

        it('WAITs even when the paywall is also unresolved — auth is strictly first', () => {
            // Both step 1 and step 2 are unsatisfied. The answer is still WAIT
            // (not SUPPRESS): nothing is decided until identity is known.
            expect(introductionVerdict({
                ...ELIGIBLE, loggedIn: true, roleResolved: false, paywallBlocking: true
            })).toBe(INTRODUCTION_WAIT);
        });

        it('does NOT wait on an anonymous viewer — anonymity is a resolved answer', () => {
            // AppUtils awaits getAccountInfo() before the store exists, so an
            // absent security.user at epic time is settled, not pending. And an
            // anonymous viewer is a non-member by definition.
            expect(introductionVerdict({
                ...ELIGIBLE, loggedIn: false, roleResolved: false
            })).toBe(INTRODUCTION_SHOW);
        });

        it('proceeds once the logged-in viewer role resolves', () => {
            expect(introductionVerdict({
                ...ELIGIBLE, loggedIn: true, roleResolved: true
            })).toBe(INTRODUCTION_SHOW);
        });
    });

    describe('2. the paywall SECOND', () => {
        it('WAITs while the paywall blocking dialog is on screen', () => {
            expect(introductionVerdict({
                ...ELIGIBLE, paywallBlocking: true
            })).toBe(INTRODUCTION_WAIT);
        });

        it('SHOWS once the paywall is satisfied', () => {
            expect(introductionVerdict({
                ...ELIGIBLE, paywallBlocking: false
            })).toBe(INTRODUCTION_SHOW);
        });

        it('WAITs rather than SUPPRESSes, so the introduction is owed later', () => {
            // The distinction is the whole point of the three-valued answer: a
            // boolean here would drop the introduction permanently for anyone
            // who happened to hit a paywall refusal on the way in.
            expect(introductionVerdict({ ...ELIGIBLE, paywallBlocking: true }))
                .toNotBe(INTRODUCTION_SUPPRESS);
        });
    });

    describe('3. the introduction LAST', () => {
        it('WAITs until the payload has arrived', () => {
            expect(introductionVerdict({
                ...ELIGIBLE, payloadLoaded: false
            })).toBe(INTRODUCTION_WAIT);
        });

        it('SUPPRESSes for a member — owner or membership holder (AC10)', () => {
            expect(introductionVerdict({
                ...ELIGIBLE, loggedIn: true, roleResolved: true, isMember: true
            })).toBe(INTRODUCTION_SUPPRESS);
        });

        it('SUPPRESSes once the CURRENT content version is accepted', () => {
            expect(introductionVerdict({
                ...ELIGIBLE, hasAccepted: true
            })).toBe(INTRODUCTION_SUPPRESS);
        });
    });

    describe('0. the ANUGA context gate (TASK-2777)', () => {
        it('SUPPRESSes off-ANUGA even when everything else is eligible', () => {
            // SWAMM / Sarara / NICP ship this same build.
            expect(introductionVerdict({
                ...ELIGIBLE, anugaContext: false
            })).toBe(INTRODUCTION_SUPPRESS);
        });

        it('SUPPRESSes off-ANUGA rather than WAITing, even mid-auth', () => {
            // Terminal, and checked before the WAIT clauses: a SWAMM viewer must
            // never end up in a queue that could later admit them.
            expect(introductionVerdict({
                ...ELIGIBLE, anugaContext: false, loggedIn: true, roleResolved: false
            })).toBe(INTRODUCTION_SUPPRESS);
        });
    });
});

// ── The selectors that bind the guard to the store ──────────────────────────

const stateWith = ({
    plugins = [{ name: 'Anuga' }, { name: 'Paywall', cfg: { paywallEnabled: true } }],
    user = null,
    project = null,
    paywall = null,
    introduction = null
} = {}) => ({
    localConfig: { plugins: { map_viewer: plugins } },
    security: user ? { user } : {},
    anuga: { projects: project ? { data: project } : {}, paywall: paywall || {} },
    simpleView: introduction ? { introduction } : {}
});

describe('introductionGate selectors', () => {
    describe('isAnugaContext — the site gate', () => {
        it('is true where the Anuga plugin is configured (hydrata.com)', () => {
            expect(isAnugaContext(stateWith())).toBe(true);
        });
        it('is false for a SimpleView-only site (SWAMM / Sarara / NICP)', () => {
            expect(isAnugaContext(stateWith({
                plugins: [{ name: 'SimpleView' }, { name: 'Swamm' }, { name: 'TaskMonitor' }]
            }))).toBe(false);
        });
        it('is false when localConfig has not loaded at all', () => {
            expect(isAnugaContext({})).toBe(false);
        });
    });

    describe('isPaywallArmed — the kill-switch (TASK-2776 AC3)', () => {
        it('is true when the Paywall plugin cfg enables it', () => {
            expect(isPaywallArmed(stateWith())).toBe(true);
        });
        it('is false when the kill-switch is off', () => {
            expect(isPaywallArmed(stateWith({
                plugins: [{ name: 'Anuga' }, { name: 'Paywall', cfg: { paywallEnabled: false } }]
            }))).toBe(false);
        });
        it('is false when the plugin is absent entirely', () => {
            expect(isPaywallArmed(stateWith({ plugins: [{ name: 'Anuga' }] }))).toBe(false);
        });
    });

    describe('isPaywallBlocking', () => {
        const upgradePrompt = {
            overlay: { state: 'upgrade_prompt' }, overlayProjectId: null, steady: null
        };

        it('blocks on a live upgrade_prompt overlay', () => {
            expect(isPaywallBlocking(stateWith({ paywall: upgradePrompt }))).toBe(true);
        });

        it('DOES NOT block when the paywall kill-switch is off (AC3)', () => {
            // With the switch off PaywallPanel renders null whatever the slice
            // says, so waiting on it would be waiting on a dialog that can never
            // appear — the introduction would simply never show.
            expect(isPaywallBlocking(stateWith({
                plugins: [{ name: 'Anuga' }, { name: 'Paywall', cfg: { paywallEnabled: false } }],
                paywall: upgradePrompt
            }))).toBe(false);
        });

        it('does not block on the non-blocking contract states', () => {
            // upgrade_prompt is the ONLY state PaywallPanel renders.
            expect(isPaywallBlocking(stateWith({
                paywall: { steady: { state: 'free_public' }, overlay: null }
            }))).toBe(false);
            expect(isPaywallBlocking(stateWith({
                paywall: { steady: { state: 'past_due' }, overlay: null }
            }))).toBe(false);
        });
    });

    describe('isIntroductionProjectMember — and the TASK-2427 staleness trap', () => {
        it('is true for a role on the project the payload describes', () => {
            expect(isIntroductionProjectMember(stateWith({
                project: { id: 13422, my_role: 'owner' },
                introduction: { projectId: 13422, data: {} }
            }))).toBe(true);
        });

        it('is false for my_role null — an authenticated NON-member (AC9)', () => {
            expect(isIntroductionProjectMember(stateWith({
                project: { id: 13422, my_role: null },
                introduction: { projectId: 13422, data: {} }
            }))).toBe(false);
        });

        it('REFUSES a role that describes a DIFFERENT project', () => {
            // state.anuga.projects.data is not reset on SPA nav, so after a hop
            // it is stale-but-truthy. Trusting it here would let a member of
            // project A silently bypass project B's disclaimer.
            expect(isIntroductionProjectMember(stateWith({
                project: { id: 999, my_role: 'owner' },
                introduction: { projectId: 13422, data: {} }
            }))).toBe(false);
        });

        it('is false when no ANUGA project is loaded (anonymous viewer)', () => {
            expect(isIntroductionProjectMember(stateWith({
                introduction: { projectId: 13422, data: {} }
            }))).toBe(false);
        });
    });

    describe('hasAcceptedCurrentIntroduction — a VERSION comparison, not a flag', () => {
        it('honours the server acceptance for an authenticated viewer', () => {
            expect(hasAcceptedCurrentIntroduction(stateWith({
                introduction: {
                    projectId: 1,
                    data: { content_version: VERSION_A, accepted_current_version: true }
                }
            }))).toBe(true);
        });

        it('honours a local acceptance of the SAME version', () => {
            expect(hasAcceptedCurrentIntroduction(stateWith({
                introduction: {
                    projectId: 1,
                    data: { content_version: VERSION_A, accepted_current_version: false },
                    acceptedVersion: VERSION_A
                }
            }))).toBe(true);
        });

        it('RE-PROMPTS when the content version has moved on (AC5)', () => {
            // The acceptance-resets-on-edit rule, implemented as a comparison.
            // An "ever accepted" boolean would silently carry consent for text
            // the viewer has never seen.
            expect(hasAcceptedCurrentIntroduction(stateWith({
                introduction: {
                    projectId: 1,
                    data: { content_version: VERSION_B, accepted_current_version: false },
                    acceptedVersion: VERSION_A
                }
            }))).toBe(false);
        });

        it('is false before the payload arrives', () => {
            expect(hasAcceptedCurrentIntroduction(stateWith())).toBe(false);
        });
    });

    describe('introductionVerdictFor — end to end over a real store shape', () => {
        it('SHOWS for an anonymous non-member on a loaded ANUGA project', () => {
            expect(introductionVerdictFor(stateWith({
                introduction: {
                    projectId: 13422,
                    data: { content_version: VERSION_A, accepted_current_version: false }
                }
            }))).toBe(INTRODUCTION_SHOW);
        });

        it('SUPPRESSes for the owner (AC10)', () => {
            expect(introductionVerdictFor(stateWith({
                user: { pk: 1 },
                project: { id: 13422, my_role: 'owner' },
                introduction: {
                    projectId: 13422,
                    data: { content_version: VERSION_A, accepted_current_version: false }
                }
            }))).toBe(INTRODUCTION_SUPPRESS);
        });

        it('SHOWS for an authenticated NON-member (AC9)', () => {
            expect(introductionVerdictFor(stateWith({
                user: { pk: 2 },
                project: { id: 13422, my_role: null },
                introduction: {
                    projectId: 13422,
                    data: { content_version: VERSION_A, accepted_current_version: false }
                }
            }))).toBe(INTRODUCTION_SHOW);
        });

        it('WAITs for a logged-in viewer whose project has not resolved yet', () => {
            expect(introductionVerdictFor(stateWith({
                user: { pk: 2 },
                introduction: {
                    projectId: 13422,
                    data: { content_version: VERSION_A, accepted_current_version: false }
                }
            }))).toBe(INTRODUCTION_WAIT);
        });

        it('SUPPRESSes on a SWAMM-shaped site with everything else eligible', () => {
            expect(introductionVerdictFor(stateWith({
                plugins: [{ name: 'SimpleView' }, { name: 'Swamm' }],
                introduction: {
                    projectId: 13422,
                    data: { content_version: VERSION_A, accepted_current_version: false }
                }
            }))).toBe(INTRODUCTION_SUPPRESS);
        });
    });
});
