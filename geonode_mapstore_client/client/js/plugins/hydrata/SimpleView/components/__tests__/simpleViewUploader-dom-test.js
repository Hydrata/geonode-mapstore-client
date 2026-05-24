/*
 * TASK-743 — simpleViewUploader DOM contract tests (P0).
 *
 * Regression guard for TASK-599 / TASK-602: the upload click handler must NEVER
 * construct a request URL containing the literal `/undefined/`. The source
 * (uploadFile, simpleViewUploader.js:204-229) early-returns when any of
 * `config?.app_name`, `projectId`, or `importerConfigKey` is missing, so the
 * URL template `${config.app_name}/api/${projectId}/${importerConfigKey}/...`
 * can never stringify `undefined` into a live request.
 *
 * These tests render the UNCONNECTED class `simpleViewUploaderPanel` through
 * the shared `mountWithProviders` helper (AC2) and drive `uploadFile` via a
 * ref. Network is intercepted with the shared `mockAxios` helper bound to the
 * MapStore2 ajax instance, so no real request escapes; we record every PUT URL
 * and assert on its shape.
 */
import expect from 'expect';
import React from 'react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import mockAxios from '../../../../../__tests__/helpers/mockAxios';
// JSX treats lowercase tags as host elements, so alias to PascalCase.
import { simpleViewUploaderPanel as SimpleViewUploaderPanel } from '../simpleViewUploader';

// Build a minimal "begin"-state base file so the Begin button / upload path works.
function makeBaseFile(name = 'elev.tif') {
    const file = new File(['x'], name, { type: 'image/tiff' });
    Object.defineProperty(file, 'status', { value: 'begin', writable: true });
    Object.defineProperty(file, 'extension', { value: name.split('.').slice(-1)[0], writable: true });
    Object.defineProperty(file, 'preview', { value: 'preview://' + name, writable: true });
    return file;
}

const noop = () => {};

const baseProps = {
    visibleUploaderPanel: true,
    serverUrl: 'https://hydrata.com/',
    setVisibleUploaderPanel: noop,
    updateUploadStatus: noop,
    setVisibleSimpleViewAttributeForm: noop,
    createSimpleViewAttributeForm: noop,
    show: noop,
    toggleTaskMonitorPanel: noop
};

describe('TASK-743 simpleViewUploader DOM', () => {
    let mock;
    let putCalls;

    beforeEach(() => {
        mock = mockAxios();
        putCalls = [];
        mock.onPut(/.*/).reply((cfg) => {
            putCalls.push(cfg.url);
            // reply with no `form` so the success branch doesn't open the attribute form
            return [200, { form: null }];
        });
    });

    it('fires NO request and builds NO url when config is undefined (the broken WKC state)', (done) => {
        const ref = React.createRef();
        mountWithProviders(
            <SimpleViewUploaderPanel
                ref={ref}
                {...baseProps}
                projectId={548}
                importerConfigKey="erosion"
                config={undefined}
            />
        );
        ref.current.uploadFile([makeBaseFile('test.tif')]);
        setTimeout(() => {
            expect(putCalls.length).toBe(0);
            done();
        }, 50);
    });

    it('fires NO request when projectId is missing', (done) => {
        const ref = React.createRef();
        mountWithProviders(
            <SimpleViewUploaderPanel
                ref={ref}
                {...baseProps}
                projectId={undefined}
                importerConfigKey="terrain"
                config={{ app_name: 'anuga' }}
            />
        );
        ref.current.uploadFile([makeBaseFile('elev.tif')]);
        setTimeout(() => {
            expect(putCalls.length).toBe(0);
            done();
        }, 50);
    });

    it('fires NO request when importerConfigKey is missing', (done) => {
        const ref = React.createRef();
        mountWithProviders(
            <SimpleViewUploaderPanel
                ref={ref}
                {...baseProps}
                projectId={42}
                importerConfigKey={undefined}
                config={{ app_name: 'anuga' }}
            />
        );
        ref.current.uploadFile([makeBaseFile('elev.tif')]);
        setTimeout(() => {
            expect(putCalls.length).toBe(0);
            done();
        }, 50);
    });

    it('builds the real importer-create url (no /undefined/) when config/project/key all present', (done) => {
        const ref = React.createRef();
        mountWithProviders(
            <SimpleViewUploaderPanel
                ref={ref}
                {...baseProps}
                projectId={42}
                importerConfigKey="terrain"
                config={{ app_name: 'anuga', title: 'Terrain', filetype: 'tif' }}
            />
        );
        ref.current.uploadFile([makeBaseFile('elev.tif')]);
        setTimeout(() => {
            expect(putCalls.length).toBe(1);
            const url = putCalls[0];
            expect(url).toNotInclude('/undefined/');
            expect(url).toNotInclude('undefined');
            expect(url).toBe('https://hydrata.com/anuga/api/42/terrain/importer-create/');
            done();
        }, 50);
    });

    it('builds the real importer-config url (no /undefined/) when importerTargetObjectId is present', (done) => {
        const ref = React.createRef();
        mountWithProviders(
            <SimpleViewUploaderPanel
                ref={ref}
                {...baseProps}
                projectId={42}
                importerConfigKey="terrain"
                importerTargetObjectId={9999}
                config={{ app_name: 'anuga', title: 'Terrain', filetype: 'tif' }}
            />
        );
        ref.current.uploadFile([makeBaseFile('elev.tif')]);
        setTimeout(() => {
            expect(putCalls.length).toBe(1);
            const url = putCalls[0];
            expect(url).toNotInclude('/undefined/');
            expect(url).toBe('https://hydrata.com/anuga/api/42/terrain/9999/importer-config/');
            done();
        }, 50);
    });

    it('disables the Begin button when config is undefined (cannot reach the network at all)', () => {
        const ref = React.createRef();
        const { container } = mountWithProviders(
            <SimpleViewUploaderPanel
                ref={ref}
                {...baseProps}
                projectId={548}
                importerConfigKey="erosion"
                config={undefined}
            />
        );
        // Inject a base file directly so the Begin button renders.
        ref.current.setState({ uploaderFiles: [makeBaseFile('test.tif')], newTitle: 'test' });
        const buttons = Array.from(container.querySelectorAll('button'));
        const beginBtn = buttons.find(b => /begin/i.test(b.textContent || '') || /begin/i.test(b.querySelector('span')?.textContent || ''));
        expect(beginBtn).toExist();
        expect(beginBtn.disabled).toBe(true);
    });
});
