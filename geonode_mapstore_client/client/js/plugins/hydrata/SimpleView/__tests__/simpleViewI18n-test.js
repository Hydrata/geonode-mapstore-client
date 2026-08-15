import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import Localized from '@mapstore/framework/components/I18N/Localized';
import mountWithProviders from '../../../../__tests__/helpers/mountWithProviders';

const { enMessages, frMessages, esMessages, htMessages } = require('../../../../__tests__/fixtures/translations');

const mockStore = {
    getState: () => ({
        simpleView: {
            openMenuGroupId: null,
            visibleLegendPanel: true,
            visibleIntroduction: false,
            visibleSimpleViewAttributeForm: false,
            visibleSimpleViewAttributeResult: false,
            simpleViewAttributeForm: {},
            config: {}
        },
        layers: {
            flat: [
                { id: 'layer1', visibility: true, group: 'test', type: 'wms', title: 'Test Layer', name: 'test_layer', opacity: 0.8 }
            ],
            groups: []
        },
        gnresource: { initialResource: { perms: [] } },
        gnsettings: { geonodeUrl: 'http://localhost' },
        controls: {},
        localConfig: { plugins: { map_viewer: [] } }
    }),
    subscribe: () => {},
    dispatch: () => {}
};

describe('SimpleView i18n', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });

    it('simpleViewLegend renders translated "Legend" in English', (done) => {
        const LegendPanel = require('../components/simpleViewLegend').default;
        ReactDOM.render(
            <Provider store={mockStore}>
                <Localized locale="en-US" messages={enMessages}>
                    <LegendPanel />
                </Localized>
            </Provider>,
            document.getElementById("container"),
            () => {
                const container = document.getElementById('container');
                const text = container.innerText || container.textContent;
                expect(text).toContain('Legend');
                done();
            }
        );
    });

    it('simpleViewLegend renders translated text in French', (done) => {
        const LegendPanel = require('../components/simpleViewLegend').default;
        ReactDOM.render(
            <Provider store={mockStore}>
                <Localized locale="fr-FR" messages={frMessages}>
                    <LegendPanel />
                </Localized>
            </Provider>,
            document.getElementById("container"),
            () => {
                const container = document.getElementById('container');
                const text = container.innerText || container.textContent;
                expect(text).toContain(frMessages['hydrata.simpleView.legend']);
                done();
            }
        );
    });

    it('simpleViewMenuRow renders translated "No datasets here yet..." when no layer', (done) => {
        const MenuRowModule = require('../components/simpleViewMenuRow');
        const MenuRow = MenuRowModule.MenuRow;
        ReactDOM.render(
            <Provider store={mockStore}>
                <Localized locale="en-US" messages={enMessages}>
                    <MenuRow />
                </Localized>
            </Provider>,
            document.getElementById("container"),
            () => {
                const container = document.getElementById('container');
                const text = container.innerText || container.textContent;
                expect(text).toContain('No datasets here yet...');
                done();
            }
        );
    });

    it('all simpleView msgIds exist in en-US translation file', () => {
        const simpleViewKeys = Object.keys(enMessages).filter(k => k.startsWith('hydrata.simpleView.'));
        expect(simpleViewKeys.length).toBeGreaterThan(15);
        simpleViewKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing value for key: ${key}`);
            expect(enMessages[key].length).toBeGreaterThan(0, `Empty value for key: ${key}`);
        });
    });

    it('notification msgIds from epicsSimpleView exist in translations', () => {
        const epicMsgIds = [
            'hydrata.simpleView.error',
            'hydrata.simpleView.failedToUpdateTitle',
            'hydrata.simpleView.importFailed',
            'hydrata.simpleView.importSuccessful',
            'hydrata.simpleView.featuresAdded'
        ];
        epicMsgIds.forEach(msgId => {
            expect(enMessages[msgId]).toExist(`Missing epic msgId: ${msgId}`);
        });
    });
});

/**
 * ── The platform Baseline disclaimer (epic 2765 W4, TASK-2779) ───────────────
 *
 * ★ THE msgId IS NOT A CHOICE. `hydrata.introduction.baseline` is named by the
 * BACKEND — `INTRODUCTION_BASELINE_MESSAGE_ID` in gn_anuga/models/project.py —
 * shipped to the client as `baseline.message_id`, and rendered by
 * simpleViewIntroduction with `<Message msgId={props.baselineMessageId} />`.
 * It is a NEW top-level `hydrata.introduction` block, NOT a sibling of
 * `hydrata.simpleView.*`. Until this subtask no locale file defined it at all,
 * so the accept-gated liability modal painted the literal string
 * "hydrata.introduction.baseline" where the disclaimer belongs:
 * MapStore's Message is a bare react-intl `<FormattedMessage>` with no
 * defaultMessage and no cross-locale chain, so a missing id renders the id.
 * That is why the last spec here renders the real modal against the real
 * catalogue instead of only asserting the key exists — a key-existence test
 * alone stays green while the live modal shows a raw id.
 *
 * ★ THERE IS EXACTLY ONE PLATFORM DISCLAIMER STRING. The old
 * `hydrata.simpleView.disclaimer` (an MIT software-warranty paragraph rendered
 * above the project content) was RETIRED into this id rather than left beside
 * it. Two platform legal paragraphs on one accept-gated screen is not
 * belt-and-braces: only the baseline id is covered by
 * INTRODUCTION_BASELINE_VERSION, so revising the other one would have shipped
 * new legal text to every already-accepted viewer with no re-prompt — the exact
 * silent gap this epic exists to close.
 *
 * ⚠ THE WORDING IS A DRAFT PENDING THE OPERATOR LEGAL PASS (open decision on
 * the epic spine). The phrase list below is deliberately a CHECKLIST against
 * terms_and_conditions.html:375 ("AS IS" and "AS AVAILABLE" Disclaimer), not
 * decoration: if the legal pass rewrites the text, these are the ToS
 * correspondences that must survive the rewrite or be consciously dropped.
 */
describe('Introduction Baseline disclaimer i18n (TASK-2779)', () => {
    const BASELINE_ID = 'hydrata.introduction.baseline';
    const LOCALES = [
        ['en-US', enMessages],
        ['fr-FR', frMessages],
        ['es-ES', esMessages],
        ['ht-HT', htMessages]
    ];

    // No body-wiping hooks here on purpose. The render spec below mounts
    // through @testing-library/react, which registers its OWN afterEach
    // cleanup; a hook that also does `document.body.innerHTML = ''` pulls the
    // container out from under it and turns any real failure into two — the
    // assertion, plus a `removeChild` NotFoundError from the hook.

    it('exists and is non-trivially long in en AND fr (epic AC15)', () => {
        expect(enMessages[BASELINE_ID]).toExist(`Missing ${BASELINE_ID} in en-US`);
        expect(enMessages[BASELINE_ID].length).toBeGreaterThan(50);
        expect(frMessages[BASELINE_ID]).toExist(`Missing ${BASELINE_ID} in fr-FR`);
        expect(frMessages[BASELINE_ID].length).toBeGreaterThan(50);
    });

    it('is a real translation in every locale that carries hydrata content', () => {
        LOCALES.forEach(([locale, messages]) => {
            expect(messages[BASELINE_ID]).toExist(`Missing ${BASELINE_ID} in ${locale}`);
            expect(messages[BASELINE_ID].length).toBeGreaterThan(50);
        });
        // There is no English fallback to fall back TO, so "left untranslated"
        // would mean an es-ES or ht-HT viewer reads English liability text on a
        // screen they are being asked to accept.
        [['fr-FR', frMessages], ['es-ES', esMessages], ['ht-HT', htMessages]].forEach(([locale, messages]) => {
            expect(messages[BASELINE_ID]).toNotBe(
                enMessages[BASELINE_ID],
                `${locale} is the English string copied, not a translation`
            );
        });
    });

    it('keeps the ToS correspondences the wording was aligned to (epic AC17)', () => {
        const en = enMessages[BASELINE_ID].toLowerCase();
        [
            'as is',                             // ToS h2 + first paragraph
            'as available',                      // ToS h2
            'fitness for a particular purpose',  // ToS implied-warranty list
            'accuracy',                          // ToS clause (iii)
            'navigation'                         // the model-fitness half
        ].forEach(phrase => {
            expect(en).toContain(phrase, `Baseline text lost its ToS anchor: ${phrase}`);
        });
    });

    it('leaves no second, unversioned platform disclaimer behind (epic AC16)', () => {
        LOCALES.forEach(([locale, messages]) => {
            expect(messages['hydrata.simpleView.disclaimer']).toNotExist(
                `${locale} still carries the retired simpleView.disclaimer`
            );
            // The other two ids audit C1 asked about are still rendered by the
            // modal (fallback title, Accept button) and stay populated.
            expect(messages['hydrata.simpleView.welcomeTitle']).toExist(`${locale} welcomeTitle`);
            expect(messages['hydrata.simpleView.accept']).toExist(`${locale} accept`);
        });
    });

    [['en-US', enMessages], ['fr-FR', frMessages]].forEach(([locale, messages]) => {
        it(`paints the baseline TEXT on the modal in ${locale}, never the raw msgId`, () => {
            const Introduction = require('../components/simpleViewIntroduction').default;
            const store = {
                getState: () => ({
                    simpleView: {
                        introduction: {
                            projectId: 13422,
                            data: {
                                project_name: 'Msimbazi baseline',
                                baseline: { message_id: BASELINE_ID, version: '2' }
                            }
                        }
                    }
                }),
                subscribe: () => () => {},
                dispatch: () => {}
            };
            // mountWithProviders (RTL) rather than a ReactDOM.render callback:
            // the callback fires mid-commit and the dialog's own portal has not
            // landed yet, so the assertion below reads an empty document.
            const { unmount } = mountWithProviders(
                <Localized locale={locale} messages={messages}>
                    <Introduction />
                </Localized>,
                { store }
            );

            // react-bootstrap portals the dialog to <body>, so query the
            // document and not the render container.
            const baseline = document.querySelector('.introduction-baseline');
            expect(baseline).toExist('the baseline block did not render');
            // Byte-for-byte, which also proves the string survives ICU parsing.
            // The French text is full of apostrophes ("l'état", "d'aucune"),
            // and an apostrophe is intl-messageformat's escape character.
            expect(baseline.textContent).toBe(messages[BASELINE_ID]);
            expect(document.body.textContent).toNotContain(BASELINE_ID);
            unmount();
        });
    });
});
