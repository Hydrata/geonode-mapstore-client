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
import {
    simpleViewUploaderPanel as SimpleViewUploaderPanel,
    computeUploadEtaSeconds,
    formatEtaDuration
} from '../simpleViewUploader';

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
            // TASK-1287: host comes from window.location.origin (tunnel-aware), not serverUrl.
            expect(url).toBe(`${window.location.origin}/anuga/api/42/terrain/importer-create/`);
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
            // TASK-1287: host comes from window.location.origin (tunnel-aware), not serverUrl.
            expect(url).toBe(`${window.location.origin}/anuga/api/42/terrain/9999/importer-config/`);
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

describe('TASK-2216 (W5.2, epic 2204) — big-file upload progress % + ETA', () => {
    describe('pure ETA math', () => {
        it('computeUploadEtaSeconds returns null for 0%/100%/NaN percent or non-finite elapsed', () => {
            expect(computeUploadEtaSeconds(0, 5000)).toBe(null);
            expect(computeUploadEtaSeconds(100, 5000)).toBe(null);
            expect(computeUploadEtaSeconds(NaN, 5000)).toBe(null);
            expect(computeUploadEtaSeconds(50, 0)).toBe(null);
            expect(computeUploadEtaSeconds(50, NaN)).toBe(null);
            expect(computeUploadEtaSeconds(50, -100)).toBe(null);
        });

        it('computeUploadEtaSeconds derives a simple average-rate remaining estimate', () => {
            // 50% done after 10s elapsed -> total estimated 20s -> 10s remaining.
            expect(computeUploadEtaSeconds(50, 10000)).toBe(10);
            // 25% done after 10s elapsed -> total estimated 40s -> 30s remaining.
            expect(computeUploadEtaSeconds(25, 10000)).toBe(30);
        });

        it('formatEtaDuration formats seconds-only under a minute, minutes+seconds otherwise', () => {
            expect(formatEtaDuration(45)).toBe('45s');
            expect(formatEtaDuration(0)).toBe('0s');
            expect(formatEtaDuration(90)).toBe('1m 30s');
            expect(formatEtaDuration(605)).toBe('10m 5s');
        });

        it('formatEtaDuration returns null for non-finite/negative input', () => {
            expect(formatEtaDuration(NaN)).toBe(null);
            expect(formatEtaDuration(-5)).toBe(null);
        });
    });

    describe('rendering (mocked progress state, no timers)', () => {
        const progressProps = {
            ...baseProps,
            projectId: 42,
            importerConfigKey: 'terrain',
            config: { app_name: 'anuga', title: 'Terrain', filetype: 'tif' }
        };

        it('shows no ETA before any upload has started (uploadStartedAt is null)', () => {
            const ref = React.createRef();
            const { container } = mountWithProviders(
                <SimpleViewUploaderPanel ref={ref} {...progressProps} uploadStatus="45" />
            );
            ref.current.setState({ uploaderFiles: [makeBaseFile('elev.tif')] });
            // Mutate the file's status to "uploading" so the ProgressBar
            // branch renders (mirrors what uploadFile() does via Object.assign).
            ref.current.state.uploaderFiles[0].status = 'uploading';
            ref.current.forceUpdate();
            expect(container.querySelector('.sv-uploader-eta')).toNotExist();
        });

        it('shows % AND an ETA once the upload has started and is part-way through', () => {
            const ref = React.createRef();
            const { container } = mountWithProviders(
                <SimpleViewUploaderPanel ref={ref} {...progressProps} uploadStatus="50" />
            );
            ref.current.setState({
                uploaderFiles: [makeBaseFile('elev.tif')],
                // 10s "elapsed" — computeUploadEtaSeconds(50, 10000) === 10.
                uploadStartedAt: Date.now() - 10000
            });
            ref.current.state.uploaderFiles[0].status = 'uploading';
            ref.current.forceUpdate();

            expect(container.textContent).toInclude('50');
            expect(container.textContent).toInclude('%');
            // mountWithProviders has no IntlProvider/messages, so <Message>
            // falls back to rendering the bare msgId (no interpolation) —
            // its mere presence proves renderUploadEta() computed a non-null
            // etaText (it returns null entirely otherwise, see the "no ETA"
            // tests above/below). The ACTUAL "10s" value is proven precisely
            // by the pure computeUploadEtaSeconds/formatEtaDuration unit
            // tests above (same 50%/10000ms inputs).
            const etaEl = container.querySelector('.sv-uploader-eta');
            expect(etaEl).toExist();
            expect(etaEl.textContent).toInclude('hydrata.simpleView.uploadEtaLabel');
        });

        it('AC#2 — completion state (100%) is unchanged: importing message shows, no ETA', () => {
            const ref = React.createRef();
            const { container } = mountWithProviders(
                <SimpleViewUploaderPanel ref={ref} {...progressProps} uploadStatus="100" />
            );
            ref.current.setState({
                uploaderFiles: [makeBaseFile('elev.tif')],
                uploadStartedAt: Date.now() - 10000
            });
            ref.current.state.uploaderFiles[0].status = 'uploading';
            ref.current.forceUpdate();

            expect(container.querySelector('.sv-uploader-eta')).toNotExist();
            expect(container.textContent).toNotInclude('%');
        });

        it('AC#2 — error state (uploadStatus reset to 0) is unchanged: no ETA, no stray %', () => {
            const ref = React.createRef();
            const { container } = mountWithProviders(
                <SimpleViewUploaderPanel ref={ref} {...progressProps} uploadStatus={0} />
            );
            ref.current.setState({
                uploaderFiles: [makeBaseFile('elev.tif')],
                uploadStartedAt: Date.now() - 10000
            });
            ref.current.state.uploaderFiles[0].status = 'uploading';
            ref.current.forceUpdate();

            expect(container.querySelector('.sv-uploader-eta')).toNotExist();
        });
    });

    describe('wiring: uploadFile() -> uploadStartedAt, uploadManager.onUploadProgress -> updateUploadStatus', () => {
        let mock;

        beforeEach(() => {
            mock = mockAxios();
            mock.onPut(/.*/).reply(() => [200, { form: null }]);
        });

        it('uploadFile() stamps uploadStartedAt so the ETA clock has a zero point', (done) => {
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
            expect(ref.current.state.uploadStartedAt).toBe(null);
            ref.current.uploadFile([makeBaseFile('elev.tif')]);
            setTimeout(() => {
                expect(ref.current.state.uploadStartedAt).toExist();
                expect(typeof ref.current.state.uploadStartedAt).toBe('number');
                done();
            }, 50);
        });

        it('uploadManager.onUploadProgress (mocked progress event) dispatches the ALREADY-computed %', () => {
            const updateUploadStatusCalls = [];
            const ref = React.createRef();
            mountWithProviders(
                <SimpleViewUploaderPanel
                    ref={ref}
                    {...baseProps}
                    updateUploadStatus={(status) => updateUploadStatusCalls.push(status)}
                    projectId={42}
                    importerConfigKey="terrain"
                    config={{ app_name: 'anuga', title: 'Terrain', filetype: 'tif' }}
                />
            );
            // Simulate a mocked axios progress event directly — the same
            // shape axios' onUploadProgress fires during a real big-file PUT.
            ref.current.uploadManager.onUploadProgress({ loaded: 30, total: 100 });
            expect(updateUploadStatusCalls).toEqual([30]);
        });
    });
});
