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

    // TASK-2463 (epic 2425 W2.8) — the stalled-confirmation toast is the FIRST
    // thing a customer sees when a webhook is slow, and it is raised from an epic
    // by msgId. A missing key renders the raw msgId, so a paying customer would
    // read "hydrata.anuga.checkoutStalled.title" — which is worse than the
    // silence this toast replaces. Asserted in every locale that carries the
    // sibling checkout keys, not just en-US.
    it('the money-path checkout toast keys exist in every locale that has the others', () => {
        const {esMessages, htMessages} = require('../../../../__tests__/fixtures/translations');
        const keys = [
            'hydrata.anuga.checkoutStalled.title',
            'hydrata.anuga.checkoutStalled.message',
            // Its siblings, so this test also pins that they never regress.
            'hydrata.anuga.checkoutCancelled.title',
            'hydrata.anuga.checkoutFailed.title'
        ];
        [['en', enMessages], ['fr', frMessages], ['es', esMessages], ['ht', htMessages]]
            .forEach(([locale, messages]) => {
                keys.forEach((key) => {
                    expect(messages[key]).toExist(`Missing ${locale} translation for: ${key}`);
                    expect(messages[key].length).toBeGreaterThan(0, `Empty ${locale} value for: ${key}`);
                });
                // The wording is load-bearing on the money path: the toast must
                // never claim the payment failed. Only the app's own uncertainty
                // is knowable (see BillingTabPanel's ConfirmingPurchaseSection).
                const msg = (messages['hydrata.anuga.checkoutStalled.message'] || '').toLowerCase();
                ['failed', 'lost', 'echwe', 'error en el pago']
                    .forEach((banned) => expect(msg).toNotInclude(
                        banned, `${locale} stalled-toast copy claims "${banned}"`
                    ));
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
