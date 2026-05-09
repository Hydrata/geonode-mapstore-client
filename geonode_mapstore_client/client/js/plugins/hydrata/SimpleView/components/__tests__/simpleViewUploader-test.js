/*
 * Tests for simpleViewUploader.js — TASK-599 regression guard.
 *
 * Bug: when `state.simpleView.config.importer_config[importerConfigKey]` was
 * undefined, the click handler stringified `undefined` into the URL template,
 * producing requests like `PUT /undefined/api/<id>/erosion/importer-create/`
 * that 404'd in production for real WKC Group users.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import MockAdapter from 'axios-mock-adapter';
import axios from '../../../../../../MapStore2/web/client/libs/ajax';
// Alias to a capitalized name — JSX treats lowercase tags as host elements,
// so we must rename to PascalCase to render the class component.
import { simpleViewUploaderPanel as SimpleViewUploaderPanel } from '../simpleViewUploader';

// Build a minimal "begin"-state file object so the Begin button renders.
function makeBaseFile(name = 'test.tif') {
    const file = new File(['x'], name, { type: 'image/tiff' });
    Object.defineProperty(file, 'status', { value: 'begin', writable: true });
    Object.defineProperty(file, 'extension', { value: 'tif', writable: true });
    Object.defineProperty(file, 'preview', { value: 'preview://' + name, writable: true });
    return file;
}

const noop = () => {};

describe('simpleViewUploader (TASK-599 /undefined/ URL guard)', () => {
    let mockAxios;
    let container;
    let putCalls;

    beforeEach(() => {
        mockAxios = new MockAdapter(axios);
        putCalls = [];
        // Match any PUT and record the URL — replies 200 so the success branch
        // doesn't blow up if a test inadvertently fires a request.
        mockAxios.onPut(/.*/).reply((cfg) => {
            putCalls.push(cfg.url);
            return [200, { form: null }];
        });
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
        mockAxios.restore();
    });

    it('test_uploadFile_bails_when_config_undefined_no_request_fired', (done) => {
        // Render with config = undefined (the broken WKC Group state)
        const ref = React.createRef();
        ReactDOM.render(
            <SimpleViewUploaderPanel
                ref={ref}
                visibleUploaderPanel
                serverUrl="https://hydrata.com/"
                projectId={548}
                importerConfigKey="erosion"
                config={undefined}
                setVisibleUploaderPanel={noop}
                updateUploadStatus={noop}
                setVisibleSimpleViewAttributeForm={noop}
                createSimpleViewAttributeForm={noop}
                show={noop}
                toggleTaskMonitorPanel={noop}
            />,
            container
        );
        // Directly invoke uploadFile — the click handler does the same.
        const file = makeBaseFile('test.tif');
        ref.current.uploadFile([file]);

        // axios.put must NOT have been called — the bail short-circuited.
        // Use setTimeout to flush any microtasks the upload might schedule.
        setTimeout(() => {
            expect(putCalls.length).toBe(0);
            done();
        }, 50);
    });

    it('test_uploadFile_with_valid_config_fires_correct_url', (done) => {
        const ref = React.createRef();
        ReactDOM.render(
            <SimpleViewUploaderPanel
                ref={ref}
                visibleUploaderPanel
                serverUrl="https://hydrata.com/"
                projectId={42}
                importerConfigKey="terrain"
                config={{ app_name: 'anuga', title: 'Terrain', filetype: 'tif' }}
                setVisibleUploaderPanel={noop}
                updateUploadStatus={noop}
                setVisibleSimpleViewAttributeForm={noop}
                createSimpleViewAttributeForm={noop}
                show={noop}
                toggleTaskMonitorPanel={noop}
            />,
            container
        );
        const file = makeBaseFile('elev.tif');
        ref.current.uploadFile([file]);

        setTimeout(() => {
            expect(putCalls.length).toBe(1);
            const url = putCalls[0];
            // No `/undefined/` anywhere in the URL.
            expect(url).toNotInclude('/undefined/');
            expect(url).toNotInclude('undefined');
            // Correct shape for the importer-create endpoint.
            expect(url).toBe('https://hydrata.com/anuga/api/42/terrain/importer-create/');
            done();
        }, 50);
    });

    it('test_begin_button_disabled_when_config_undefined', () => {
        // Render with a base file already in state so the Begin button shows.
        const ref = React.createRef();
        ReactDOM.render(
            <SimpleViewUploaderPanel
                ref={ref}
                visibleUploaderPanel
                serverUrl="https://hydrata.com/"
                projectId={548}
                importerConfigKey="erosion"
                config={undefined}
                setVisibleUploaderPanel={noop}
                updateUploadStatus={noop}
                setVisibleSimpleViewAttributeForm={noop}
                createSimpleViewAttributeForm={noop}
                show={noop}
                toggleTaskMonitorPanel={noop}
            />,
            container
        );
        // Inject a base file directly into component state so the Begin button renders.
        ref.current.setState({ uploaderFiles: [makeBaseFile('test.tif')], newTitle: 'test' });
        // Find the Begin button.
        const buttons = Array.from(container.querySelectorAll('button'));
        const beginBtn = buttons.find(b => /Begin|begin/i.test(b.textContent || ''));
        expect(beginBtn).toExist();
        expect(beginBtn.disabled).toBe(true);
    });

    it('test_begin_button_enabled_when_config_present', () => {
        const ref = React.createRef();
        ReactDOM.render(
            <SimpleViewUploaderPanel
                ref={ref}
                visibleUploaderPanel
                serverUrl="https://hydrata.com/"
                projectId={42}
                importerConfigKey="terrain"
                config={{ app_name: 'anuga', title: 'Terrain', filetype: 'tif' }}
                setVisibleUploaderPanel={noop}
                updateUploadStatus={noop}
                setVisibleSimpleViewAttributeForm={noop}
                createSimpleViewAttributeForm={noop}
                show={noop}
                toggleTaskMonitorPanel={noop}
            />,
            container
        );
        ref.current.setState({ uploaderFiles: [makeBaseFile('test.tif')], newTitle: 'test' });
        const buttons = Array.from(container.querySelectorAll('button'));
        const beginBtn = buttons.find(b => /Begin|begin/i.test(b.textContent || ''));
        expect(beginBtn).toExist();
        expect(beginBtn.disabled).toBe(false);
    });

    it('test_uploadFile_bails_when_projectId_missing', (done) => {
        const ref = React.createRef();
        ReactDOM.render(
            <SimpleViewUploaderPanel
                ref={ref}
                visibleUploaderPanel
                serverUrl="https://hydrata.com/"
                projectId={undefined}
                importerConfigKey="terrain"
                config={{ app_name: 'anuga' }}
                setVisibleUploaderPanel={noop}
                updateUploadStatus={noop}
                setVisibleSimpleViewAttributeForm={noop}
                createSimpleViewAttributeForm={noop}
                show={noop}
                toggleTaskMonitorPanel={noop}
            />,
            container
        );
        ref.current.uploadFile([makeBaseFile('e.tif')]);
        setTimeout(() => {
            expect(putCalls.length).toBe(0);
            done();
        }, 50);
    });

    it('test_importer_config_url_also_guarded', (done) => {
        // The `importer-config/` PUT (line 223 in source) hits the same
        // `${this.props?.config?.app_name}` template — guard must cover it too.
        const ref = React.createRef();
        ReactDOM.render(
            <SimpleViewUploaderPanel
                ref={ref}
                visibleUploaderPanel
                serverUrl="https://hydrata.com/"
                projectId={548}
                importerConfigKey="erosion"
                importerTargetObjectId={9999}
                config={undefined}
                setVisibleUploaderPanel={noop}
                updateUploadStatus={noop}
                setVisibleSimpleViewAttributeForm={noop}
                createSimpleViewAttributeForm={noop}
                show={noop}
                toggleTaskMonitorPanel={noop}
            />,
            container
        );
        ref.current.uploadFile([makeBaseFile('test.tif')]);
        setTimeout(() => {
            expect(putCalls.length).toBe(0);
            done();
        }, 50);
    });
});

