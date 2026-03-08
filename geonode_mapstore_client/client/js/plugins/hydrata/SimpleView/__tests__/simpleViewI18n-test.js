import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import Localized from '@mapstore/framework/components/I18N/Localized';

const enData = require('../../../../../../static/mapstore/hydrata-translations/data.en-US.json');
const frData = require('../../../../../../static/mapstore/hydrata-translations/data.fr-FR.json');

function flattenMessages(obj, prefix) {
    let result = {};
    Object.keys(obj).forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            Object.assign(result, flattenMessages(obj[key], fullKey));
        } else {
            result[fullKey] = obj[key];
        }
    });
    return result;
}

const enMessages = flattenMessages(enData.messages);
const frMessages = flattenMessages(frData.messages);

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
