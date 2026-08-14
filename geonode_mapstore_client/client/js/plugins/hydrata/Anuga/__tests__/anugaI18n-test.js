import expect from 'expect';

const { enMessages, frMessages } = require('../../../../__tests__/fixtures/translations');

describe('Anuga i18n', () => {
    it('all anuga msgIds exist in en-US translation file', () => {
        const anugaKeys = Object.keys(enMessages).filter(k => k.startsWith('hydrata.anuga.'));
        expect(anugaKeys.length).toBeGreaterThan(30);
        anugaKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing value for key: ${key}`);
            expect(enMessages[key].length).toBeGreaterThan(0, `Empty value for key: ${key}`);
        });
    });

    it('notification msgIds from epicsAnuga exist in translations', () => {
        const epicMsgIds = [
            'hydrata.anuga.newLayersMessage',
            'hydrata.anuga.newLayersTitle',
            'hydrata.anuga.cancelling',
            'hydrata.anuga.cancelled',
            'hydrata.anuga.cancelError',
            'hydrata.anuga.retrySuccess',
            'hydrata.anuga.retryError',
            'hydrata.anuga.networkSaved',
            'hydrata.anuga.networkSaveError'
        ];
        epicMsgIds.forEach(msgId => {
            expect(enMessages[msgId]).toExist(`Missing epic msgId: ${msgId}`);
        });
    });

    it('v2 state machine status keys exist', () => {
        const statusKeys = [
            'hydrata.anuga.statusCreated',
            'hydrata.anuga.statusBuilding',
            'hydrata.anuga.statusBuilt',
            'hydrata.anuga.statusQueued',
            'hydrata.anuga.statusComputing',
            'hydrata.anuga.statusProcessing',
            'hydrata.anuga.statusComplete',
            'hydrata.anuga.statusError',
            'hydrata.anuga.statusCancelled'
        ];
        statusKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing status key: ${key}`);
            expect(enMessages[key].length).toBeGreaterThan(0, `Empty value for status key: ${key}`);
        });
    });

    it('run lifecycle keys exist', () => {
        // TASK-2194 (epic 2190 W2): computeBackend/computeLocal/computeEc2/
        // computeBatch retired with the superuser local/batch selector; the
        // staff selector's row label is computeTarget (its OPTION labels are
        // spec-verbatim English strings, not msgIds).
        const runKeys = [
            'hydrata.anuga.retry',
            'hydrata.anuga.cancel',
            'hydrata.anuga.save',
            'hydrata.anuga.computeTarget'
        ];
        runKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing run lifecycle key: ${key}`);
        });
    });

    it('UI navigation keys are translated in French', () => {
        const uiKeys = [
            'hydrata.anuga.inputs',
            'hydrata.anuga.scenarios',
            'hydrata.anuga.hydraulicsTab',
            'hydrata.anuga.results',
            'hydrata.anuga.publish'
        ];
        uiKeys.forEach(key => {
            expect(frMessages[key]).toExist(`Missing French translation for: ${key}`);
            expect(frMessages[key].length).toBeGreaterThan(0);
        });
    });

    // TASK-2039 (F4, epic 2037 W2) — the terrain-upload CRS confirm panel
    // rendered raw msgIds (never defined in any translation file) because
    // the component referenced these ids but no data.*.json ever defined
    // them. Pin the full set so it can never silently regress again.
    it('terrainCrs* keys (F4, terrainUploadCrsPanel.js) exist and are non-empty', () => {
        const terrainCrsKeys = [
            'hydrata.anuga.terrainCrsPanelTitle',
            'hydrata.anuga.terrainCrsTitleLabel',
            'hydrata.anuga.terrainCrsDetecting',
            'hydrata.anuga.terrainCrsDetected',
            'hydrata.anuga.terrainCrsRequiredPrompt',
            'hydrata.anuga.terrainCrsOptionalPrompt',
            'hydrata.anuga.terrainCrsSourceLabel',
            'hydrata.anuga.terrainCrsFreeformLabel',
            'hydrata.anuga.terrainCrsWillVerify',
            'hydrata.anuga.terrainCrsCancel',
            'hydrata.anuga.terrainCrsConfirm'
        ];
        terrainCrsKeys.forEach((key) => {
            expect(enMessages[key]).toExist(`Missing key: ${key}`);
            expect(enMessages[key].length).toBeGreaterThan(0, `Empty value for key: ${key}`);
            expect(frMessages[key]).toExist(`Missing French translation for: ${key}`);
        });
        // The detected-CRS message MUST carry the {crs} interpolation placeholder —
        // without it the actual detected CRS can never be surfaced to the user
        // (the dogfood-flagged trust gap).
        expect(enMessages['hydrata.anuga.terrainCrsDetected']).toMatch(/\{crs\}/);
    });

    // The two money-path toasts that survive: checkout CANCELLED and checkout
    // create-session FAILED. Both are raised from paywallEpics.js by msgId, so a
    // missing key renders the raw id to a customer mid-purchase. Asserted in
    // every locale that carries them, not just en-US.
    //
    // TASK-2486 (epic 2425 W2.9) — a third member, `hydrata.anuga.checkoutStalled.*`,
    // is GONE, along with the toast it fed. W2.8 raised that one with
    // autoDismiss:0 on the poll's give-up tail; there is no
    // notification-retraction path in this codebase, so it could not be taken
    // back when the webhook landed a minute later and refuted it. Keys deleted
    // from all four locales that had them rather than left behind — an i18n test
    // asserting keys for a toast that cannot be raised is the vacuous kind.
    //
    // W2.10 (operator decision 2026-07-26) went further and removed the SILENT
    // give-up surface too: the poll now clears the overlay after 60s and says
    // nothing at all, exactly as it did before W2.8. So the two keys asserted
    // here are the only money-path toasts left, and the toNotExist below guards
    // a third from returning by the toast route.
    it('the money-path checkout toast keys exist in every locale that has the others', () => {
        const {esMessages, htMessages} = require('../../../../__tests__/fixtures/translations');
        const keys = [
            'hydrata.anuga.checkoutCancelled.title',
            'hydrata.anuga.checkoutCancelled.message',
            'hydrata.anuga.checkoutFailed.title',
            'hydrata.anuga.checkoutFailed.message'
        ];
        [['en', enMessages], ['fr', frMessages], ['es', esMessages], ['ht', htMessages]]
            .forEach(([locale, messages]) => {
                keys.forEach((key) => {
                    expect(messages[key]).toExist(`Missing ${locale} translation for: ${key}`);
                    expect(messages[key].length).toBeGreaterThan(0, `Empty ${locale} value for: ${key}`);
                });
                expect(messages['hydrata.anuga.checkoutStalled.title']).toNotExist(
                    `${locale} still carries the retired stalled-toast key — the toast it fed `
                    + 'was removed because it could never be retracted'
                );
            });
    });

    it('the retired culvert keys are gone from every locale', () => {
        // TASK-2742 (W5, epic 2706) — the Culverts affordance was retired: no
        // backend route, nothing dispatching its action, and an unregistered
        // epic behind it. Its two strings promised "draw culverts on the map",
        // which was never true. Same guard shape as the checkoutStalled
        // toNotExist above: keep a retired string from drifting back in via a
        // translation pass.
        const {esMessages, htMessages} = require('../../../../__tests__/fixtures/translations');
        const retired = ['hydrata.anuga.culverts', 'hydrata.anuga.culvertPlaceholder'];
        [['en', enMessages], ['fr', frMessages], ['es', esMessages], ['ht', htMessages]]
            .forEach(([locale, messages]) => {
                // POSITIVE CONTROL — a fixture that failed to load would make
                // every absence check below pass for the wrong reason.
                expect(messages['hydrata.anuga.structures']).toExist(
                    `${locale} fixture did not load — the absence checks below would be vacuous`
                );
                retired.forEach((key) => {
                    expect(messages[key]).toNotExist(
                        `${locale} still carries the retired culvert key ${key} — the affordance `
                        + 'it labelled has no backend route and no create control (TASK-2742)'
                    );
                });
            });
    });

    it('core navigation keys exist', () => {
        const requiredKeys = [
            'hydrata.anuga.inputs',
            'hydrata.anuga.scenarios',
            'hydrata.anuga.hydraulicsTab',
            'hydrata.anuga.results',
            'hydrata.anuga.publish',
            'hydrata.anuga.run',
            'hydrata.anuga.build',
            'hydrata.anuga.log',
            'hydrata.anuga.download',
            'hydrata.anuga.yourProjects'
        ];
        requiredKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing required key: ${key}`);
        });
    });
});
