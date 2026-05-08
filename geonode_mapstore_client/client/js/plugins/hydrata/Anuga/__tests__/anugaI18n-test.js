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
        const runKeys = [
            'hydrata.anuga.retry',
            'hydrata.anuga.cancel',
            'hydrata.anuga.save',
            'hydrata.anuga.computeBackend',
            'hydrata.anuga.computeLocal',
            'hydrata.anuga.computeEc2',
            'hydrata.anuga.computeBatch'
        ];
        runKeys.forEach(key => {
            expect(enMessages[key]).toExist(`Missing run lifecycle key: ${key}`);
        });
    });

    it('UI navigation keys are translated in French', () => {
        const uiKeys = [
            'hydrata.anuga.inputs',
            'hydrata.anuga.scenarios',
            'hydrata.anuga.results',
            'hydrata.anuga.publish'
        ];
        uiKeys.forEach(key => {
            expect(frMessages[key]).toExist(`Missing French translation for: ${key}`);
            expect(frMessages[key].length).toBeGreaterThan(0);
        });
    });

    it('core navigation keys exist', () => {
        const requiredKeys = [
            'hydrata.anuga.inputs',
            'hydrata.anuga.scenarios',
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
