import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {LayerActionToolbar} from '../LayerActionToolbar';

/**
 * TASK-1008 W4: render tests for the LayerActionToolbar primitive.
 *
 * TASK-1010 W6-polish — the locked 4-icon order is now
 * `vis | zoom | edit | download`. Delete moved out of this primitive and
 * into the secondary toolbar in simpleViewMenuRow.js (alongside upload).
 * Tests for the trash glyph + delete-confirm overlay now live in
 * simpleViewMenuRowDelete-test.js (where the container owns that state
 * machine).
 *
 * The primitive remains presentation-only (no redux). `canEdit` and
 * `canDownload` arrive pre-AND'd from the container. i18n elements are
 * not asserted by resolved text — Karma+JSDOM does not mount a locale
 * provider here.
 */

const makeLayer = (overrides = {}) => ({
    id: 'L1',
    title: 'My Layer',
    visibility: true,
    ...overrides
});

describe('SimpleView LayerActionToolbar primitive (TASK-1007 W3, tested in W4)', () => {
    let container;

    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        container = document.getElementById('container');
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.innerHTML = '';
        setTimeout(done);
    });

    describe('Toolbar locked-order (4 glyphs, vis -> zoom -> edit -> download) — AC#2', () => {
        it('renders exactly 4 .sv-menu-row-glyph spans when canEdit && canDownload', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDownload />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.sv-menu-row-glyph');
                    expect(glyphs.length).toBe(4);
                    done();
                }
            );
        });

        it('renders exactly 3 .sv-menu-row-glyph spans when canEdit && !canDownload (no download)', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDownload={false} />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.sv-menu-row-glyph');
                    expect(glyphs.length).toBe(3);
                    expect(container.querySelector('.glyphicon-download')).toNotExist();
                    done();
                }
            );
        });

        it('renders exactly 3 .sv-menu-row-glyph spans when !canEdit && canDownload (no pencil)', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDownload />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.sv-menu-row-glyph');
                    expect(glyphs.length).toBe(3);
                    expect(container.querySelector('.sv-glyph-edit')).toNotExist();
                    done();
                }
            );
        });

        it('renders exactly 2 .sv-menu-row-glyph spans when !canEdit && !canDownload', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDownload={false} />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.sv-menu-row-glyph');
                    expect(glyphs.length).toBe(2);
                    expect(container.querySelector('.sv-glyph-edit')).toNotExist();
                    expect(container.querySelector('.glyphicon-download')).toNotExist();
                    done();
                }
            );
        });

        it('locks glyph order to vis(0) -> zoom(1) -> edit(2) -> download(3) when all visible', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDownload />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.sv-menu-row-glyph');
                    expect(glyphs[0].className).toInclude('glyphicon-ok');
                    expect(glyphs[1].className).toInclude('glyphicon-zoom-to');
                    expect(glyphs[2].className).toInclude('glyphicon-pencil');
                    expect(glyphs[3].className).toInclude('glyphicon-download');
                    done();
                }
            );
        });

        it('keeps relative order vis(0) -> zoom(1) -> download(2) when canEdit=false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDownload />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.sv-menu-row-glyph');
                    expect(glyphs[0].className).toInclude('glyphicon-ok');
                    expect(glyphs[1].className).toInclude('glyphicon-zoom-to');
                    expect(glyphs[2].className).toInclude('glyphicon-download');
                    done();
                }
            );
        });

        it('keeps relative order vis(0) -> zoom(1) -> edit(2) when canDownload=false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDownload={false} />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.sv-menu-row-glyph');
                    expect(glyphs[0].className).toInclude('glyphicon-ok');
                    expect(glyphs[1].className).toInclude('glyphicon-zoom-to');
                    expect(glyphs[2].className).toInclude('glyphicon-pencil');
                    done();
                }
            );
        });
    });

    describe('Visibility glyph', () => {
        it('renders glyphicon-ok + sv-glyph-active when layer.visibility === true', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer({visibility: true})} canEdit canDownload />,
                container,
                () => {
                    const glyph = container.querySelectorAll('.sv-menu-row-glyph')[0];
                    expect(glyph.className).toInclude('glyphicon-ok');
                    expect(glyph.className).toInclude('sv-glyph-active');
                    expect(glyph.className).toNotInclude('sv-glyph-inactive');
                    done();
                }
            );
        });

        it('renders glyphicon-remove + sv-glyph-inactive when layer.visibility === false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer({visibility: false})} canEdit canDownload />,
                container,
                () => {
                    const glyph = container.querySelectorAll('.sv-menu-row-glyph')[0];
                    expect(glyph.className).toInclude('glyphicon-remove');
                    expect(glyph.className).toInclude('sv-glyph-inactive');
                    expect(glyph.className).toNotInclude('sv-glyph-active');
                    done();
                }
            );
        });

        it('invokes onToggleVisibility exactly once when clicked', (done) => {
            let toggles = 0;
            const onToggleVisibility = () => { toggles++; };
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDownload
                    onToggleVisibility={onToggleVisibility}
                />,
                container,
                () => {
                    const glyph = container.querySelectorAll('.sv-menu-row-glyph')[0];
                    glyph.click();
                    expect(toggles).toBe(1);
                    done();
                }
            );
        });
    });

    describe('Zoom glyph', () => {
        it('always renders with glyphicon-zoom-to + sv-glyph-zoom', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDownload={false} />,
                container,
                () => {
                    const zoom = container.querySelector('.sv-glyph-zoom');
                    expect(zoom).toExist();
                    expect(zoom.className).toInclude('glyphicon-zoom-to');
                    expect(zoom.className).toInclude('sv-menu-row-glyph');
                    done();
                }
            );
        });

        it('invokes onZoom exactly once when clicked', (done) => {
            let zooms = 0;
            const onZoom = () => { zooms++; };
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDownload
                    onZoom={onZoom}
                />,
                container,
                () => {
                    container.querySelector('.sv-glyph-zoom').click();
                    expect(zooms).toBe(1);
                    done();
                }
            );
        });
    });

    describe('Edit glyph (pencil)', () => {
        it('renders glyphicon-pencil + sv-glyph-edit when canEdit=true', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDownload={false} />,
                container,
                () => {
                    const edit = container.querySelector('.sv-glyph-edit');
                    expect(edit).toExist();
                    expect(edit.className).toInclude('glyphicon-pencil');
                    expect(edit.className).toInclude('sv-menu-row-glyph');
                    done();
                }
            );
        });

        it('does NOT render any .sv-glyph-edit when canEdit=false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDownload />,
                container,
                () => {
                    expect(container.querySelector('.sv-glyph-edit')).toNotExist();
                    expect(container.querySelector('.glyphicon-pencil')).toNotExist();
                    done();
                }
            );
        });

        it('invokes onEdit exactly once when clicked', (done) => {
            let edits = 0;
            const onEdit = () => { edits++; };
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDownload
                    onEdit={onEdit}
                />,
                container,
                () => {
                    container.querySelector('.sv-glyph-edit').click();
                    expect(edits).toBe(1);
                    done();
                }
            );
        });
    });

    describe('Download glyph (TASK-1010 — swapped in for trash)', () => {
        it('renders glyphicon-download + sv-glyph-active when canDownload=true', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDownload />,
                container,
                () => {
                    const download = container.querySelector('.glyphicon-download');
                    expect(download).toExist();
                    expect(download.className).toInclude('sv-menu-row-glyph');
                    expect(download.className).toInclude('sv-glyph-active');
                    done();
                }
            );
        });

        it('does NOT render any .glyphicon-download when canDownload=false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDownload={false} />,
                container,
                () => {
                    expect(container.querySelector('.glyphicon-download')).toNotExist();
                    done();
                }
            );
        });

        it('invokes onDownload exactly once when clicked', (done) => {
            let downloads = 0;
            const onDownload = () => { downloads++; };
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDownload
                    onDownload={onDownload}
                />,
                container,
                () => {
                    container.querySelector('.glyphicon-download').click();
                    expect(downloads).toBe(1);
                    done();
                }
            );
        });
    });

    describe('Primitive no longer renders delete glyph or confirm overlay (TASK-1010 — moved to simpleViewMenuRow)', () => {
        it('never renders .sv-glyph-delete inside the primitive (now lives in secondary toolbar)', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDownload />,
                container,
                () => {
                    expect(container.querySelector('.sv-glyph-delete')).toNotExist();
                    expect(container.querySelector('.glyphicon-trash')).toNotExist();
                    done();
                }
            );
        });

        it('never renders .sv-menu-row-delete-confirm inside the primitive (now lives in secondary toolbar)', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDownload />,
                container,
                () => {
                    expect(container.querySelector('.sv-menu-row-delete-confirm')).toNotExist();
                    done();
                }
            );
        });
    });
});
