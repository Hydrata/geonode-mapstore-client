import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {LayerActionToolbar} from '../LayerActionToolbar';

/**
 * TASK-1008 W4: render tests for the LayerActionToolbar primitive.
 *
 * The primitive is presentation-only (no redux). It renders the locked-order
 * 4-glyph toolbar `vis | zoom | edit | delete` plus an always-mounted
 * delete-confirm overlay (R04 CSS-toggle pattern via `is-open`).
 *
 * `canEdit` / `canDelete` arrive pre-AND'd from the container (the polish
 * chore dropped `canEditMap`). i18n elements are asserted as present but not
 * by resolved text — Karma+JSDOM does not mount a locale provider here.
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

    describe('Toolbar locked-order (4 glyphs, vis -> zoom -> edit -> delete) — AC#2', () => {
        it('renders exactly 4 .menu-row-glyph spans when canEdit && canDelete', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDelete />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.menu-row-glyph');
                    expect(glyphs.length).toBe(4);
                    done();
                }
            );
        });

        it('renders exactly 3 .menu-row-glyph spans when canEdit && !canDelete (no trash)', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDelete={false} />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.menu-row-glyph');
                    expect(glyphs.length).toBe(3);
                    expect(container.querySelector('.glyph-delete')).toNotExist();
                    done();
                }
            );
        });

        it('renders exactly 3 .menu-row-glyph spans when !canEdit && canDelete (no pencil)', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDelete />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.menu-row-glyph');
                    expect(glyphs.length).toBe(3);
                    expect(container.querySelector('.glyph-edit')).toNotExist();
                    done();
                }
            );
        });

        it('renders exactly 2 .menu-row-glyph spans when !canEdit && !canDelete', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDelete={false} />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.menu-row-glyph');
                    expect(glyphs.length).toBe(2);
                    expect(container.querySelector('.glyph-edit')).toNotExist();
                    expect(container.querySelector('.glyph-delete')).toNotExist();
                    done();
                }
            );
        });

        it('locks glyph order to vis(0) -> zoom(1) -> edit(2) -> delete(3) when all visible', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDelete />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.menu-row-glyph');
                    expect(glyphs[0].className).toInclude('glyphicon-ok');
                    expect(glyphs[1].className).toInclude('glyphicon-zoom-to');
                    expect(glyphs[2].className).toInclude('glyphicon-pencil');
                    expect(glyphs[3].className).toInclude('glyphicon-trash');
                    done();
                }
            );
        });

        it('keeps relative order vis(0) -> zoom(1) -> delete(2) when canEdit=false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDelete />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.menu-row-glyph');
                    expect(glyphs[0].className).toInclude('glyphicon-ok');
                    expect(glyphs[1].className).toInclude('glyphicon-zoom-to');
                    expect(glyphs[2].className).toInclude('glyphicon-trash');
                    done();
                }
            );
        });

        it('keeps relative order vis(0) -> zoom(1) -> edit(2) when canDelete=false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDelete={false} />,
                container,
                () => {
                    const glyphs = container.querySelectorAll('.menu-row-glyph');
                    expect(glyphs[0].className).toInclude('glyphicon-ok');
                    expect(glyphs[1].className).toInclude('glyphicon-zoom-to');
                    expect(glyphs[2].className).toInclude('glyphicon-pencil');
                    done();
                }
            );
        });
    });

    describe('Visibility glyph', () => {
        it('renders glyphicon-ok + glyph-active when layer.visibility === true', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer({visibility: true})} canEdit canDelete />,
                container,
                () => {
                    const glyph = container.querySelectorAll('.menu-row-glyph')[0];
                    expect(glyph.className).toInclude('glyphicon-ok');
                    expect(glyph.className).toInclude('glyph-active');
                    expect(glyph.className).toNotInclude('glyph-inactive');
                    done();
                }
            );
        });

        it('renders glyphicon-remove + glyph-inactive when layer.visibility === false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer({visibility: false})} canEdit canDelete />,
                container,
                () => {
                    const glyph = container.querySelectorAll('.menu-row-glyph')[0];
                    expect(glyph.className).toInclude('glyphicon-remove');
                    expect(glyph.className).toInclude('glyph-inactive');
                    expect(glyph.className).toNotInclude('glyph-active');
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
                    canDelete
                    onToggleVisibility={onToggleVisibility}
                />,
                container,
                () => {
                    const glyph = container.querySelectorAll('.menu-row-glyph')[0];
                    glyph.click();
                    expect(toggles).toBe(1);
                    done();
                }
            );
        });
    });

    describe('Zoom glyph', () => {
        it('always renders with glyphicon-zoom-to + glyph-zoom', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDelete={false} />,
                container,
                () => {
                    const zoom = container.querySelector('.glyph-zoom');
                    expect(zoom).toExist();
                    expect(zoom.className).toInclude('glyphicon-zoom-to');
                    expect(zoom.className).toInclude('menu-row-glyph');
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
                    canDelete
                    onZoom={onZoom}
                />,
                container,
                () => {
                    container.querySelector('.glyph-zoom').click();
                    expect(zooms).toBe(1);
                    done();
                }
            );
        });
    });

    describe('Edit glyph (pencil)', () => {
        it('renders glyphicon-pencil + glyph-edit when canEdit=true', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDelete={false} />,
                container,
                () => {
                    const edit = container.querySelector('.glyph-edit');
                    expect(edit).toExist();
                    expect(edit.className).toInclude('glyphicon-pencil');
                    expect(edit.className).toInclude('menu-row-glyph');
                    done();
                }
            );
        });

        it('does NOT render any .glyph-edit when canEdit=false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDelete />,
                container,
                () => {
                    expect(container.querySelector('.glyph-edit')).toNotExist();
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
                    canDelete
                    onEdit={onEdit}
                />,
                container,
                () => {
                    container.querySelector('.glyph-edit').click();
                    expect(edits).toBe(1);
                    done();
                }
            );
        });
    });

    describe('Delete glyph (trash)', () => {
        it('renders glyphicon-trash + glyph-delete when canDelete=true', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit={false} canDelete />,
                container,
                () => {
                    const del = container.querySelector('.glyph-delete');
                    expect(del).toExist();
                    expect(del.className).toInclude('glyphicon-trash');
                    expect(del.className).toInclude('menu-row-glyph');
                    done();
                }
            );
        });

        it('does NOT render any .glyph-delete when canDelete=false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDelete={false} />,
                container,
                () => {
                    expect(container.querySelector('.glyph-delete')).toNotExist();
                    done();
                }
            );
        });

        it('invokes onDelete exactly once when clicked and deleting=false', (done) => {
            let deletes = 0;
            const onDelete = () => { deletes++; };
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDelete
                    deleting={false}
                    onDelete={onDelete}
                />,
                container,
                () => {
                    container.querySelector('.glyph-delete').click();
                    expect(deletes).toBe(1);
                    done();
                }
            );
        });

        it('adds glyph-disabled modifier and aria-disabled when deleting=true, and click is a no-op', (done) => {
            let deletes = 0;
            const onDelete = () => { deletes++; };
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDelete
                    deleting
                    onDelete={onDelete}
                />,
                container,
                () => {
                    const del = container.querySelector('.glyph-delete');
                    expect(del.className).toInclude('glyph-disabled');
                    expect(del.getAttribute('aria-disabled')).toBe('true');
                    del.click();
                    expect(deletes).toBe(0);
                    done();
                }
            );
        });

        it('adds glyph-hidden modifier when deleteConfirmVisible=true (R04 always-mounted)', (done) => {
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDelete
                    deleteConfirmVisible
                />,
                container,
                () => {
                    const del = container.querySelector('.glyph-delete');
                    expect(del.className).toInclude('glyph-hidden');
                    done();
                }
            );
        });

        it('does NOT add glyph-hidden modifier when deleteConfirmVisible=false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDelete
                    deleteConfirmVisible={false}
                />,
                container,
                () => {
                    const del = container.querySelector('.glyph-delete');
                    expect(del.className).toNotInclude('glyph-hidden');
                    done();
                }
            );
        });
    });

    describe('Delete-confirm overlay (always-mounted CSS-toggle — R04)', () => {
        it('mounts .menu-row-delete-confirm in the DOM when canDelete=true and deleteConfirmVisible=false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDelete
                    deleteConfirmVisible={false}
                />,
                container,
                () => {
                    const overlay = container.querySelector('.menu-row-delete-confirm');
                    expect(overlay).toExist();
                    expect(overlay.className).toNotInclude('is-open');
                    expect(overlay.getAttribute('aria-hidden')).toBe('true');
                    done();
                }
            );
        });

        it('adds .is-open class when deleteConfirmVisible=true (and clears aria-hidden)', (done) => {
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDelete
                    deleteConfirmVisible
                />,
                container,
                () => {
                    const overlay = container.querySelector('.menu-row-delete-confirm.is-open');
                    expect(overlay).toExist();
                    // aria-hidden is cleared when the overlay is visible
                    expect(overlay.getAttribute('aria-hidden')).toNotBe('true');
                    done();
                }
            );
        });

        it('does NOT mount .menu-row-delete-confirm when canDelete=false', (done) => {
            ReactDOM.render(
                <LayerActionToolbar layer={makeLayer()} canEdit canDelete={false} />,
                container,
                () => {
                    expect(container.querySelector('.menu-row-delete-confirm')).toNotExist();
                    done();
                }
            );
        });

        it('renders i18n Message elements (hydrata.simpleView.confirmDelete + delete + cancel) inside the overlay', (done) => {
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDelete
                    deleteConfirmVisible
                />,
                container,
                () => {
                    const overlay = container.querySelector('.menu-row-delete-confirm');
                    expect(overlay).toExist();
                    // assert structural buttons exist; resolved i18n text is not
                    // checked (no locale provider mounted in this karma harness)
                    expect(overlay.querySelector('.save-confirm-btn.danger')).toExist();
                    expect(overlay.querySelector('.save-confirm-btn.cancel')).toExist();
                    expect(overlay.querySelector('.menu-row-delete-confirm-text')).toExist();
                    done();
                }
            );
        });
    });

    describe('Confirm/Cancel buttons inside the overlay', () => {
        it('invokes onConfirmDelete exactly once when .save-confirm-btn.danger is clicked', (done) => {
            let confirms = 0;
            const onConfirmDelete = () => { confirms++; };
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDelete
                    deleteConfirmVisible
                    onConfirmDelete={onConfirmDelete}
                />,
                container,
                () => {
                    container.querySelector('.save-confirm-btn.danger').click();
                    expect(confirms).toBe(1);
                    done();
                }
            );
        });

        it('invokes onCancelDelete exactly once when .save-confirm-btn.cancel is clicked', (done) => {
            let cancels = 0;
            const onCancelDelete = () => { cancels++; };
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDelete
                    deleteConfirmVisible
                    onCancelDelete={onCancelDelete}
                />,
                container,
                () => {
                    container.querySelector('.save-confirm-btn.cancel').click();
                    expect(cancels).toBe(1);
                    done();
                }
            );
        });

        it('mounts BOTH confirm + cancel buttons even when deleteConfirmVisible=false (always-mounted)', (done) => {
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDelete
                    deleteConfirmVisible={false}
                />,
                container,
                () => {
                    expect(container.querySelector('.save-confirm-btn.danger')).toExist();
                    expect(container.querySelector('.save-confirm-btn.cancel')).toExist();
                    done();
                }
            );
        });
    });

    describe('Inner glyphicon-trash inside the confirm overlay does NOT participate in toolbar count', () => {
        it('has the inner trash icon but it lacks .menu-row-glyph (so the 4-glyph count is preserved)', (done) => {
            ReactDOM.render(
                <LayerActionToolbar
                    layer={makeLayer()}
                    canEdit
                    canDelete
                    deleteConfirmVisible
                />,
                container,
                () => {
                    expect(container.querySelectorAll('.glyphicon-trash').length).toBe(2);
                    expect(container.querySelectorAll('.menu-row-glyph.glyphicon-trash').length).toBe(1);
                    expect(container.querySelectorAll('.menu-row-glyph').length).toBe(4);
                    done();
                }
            );
        });
    });
});
