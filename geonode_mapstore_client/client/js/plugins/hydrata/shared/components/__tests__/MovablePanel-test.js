/*
 * TASK-2233 — MovablePanel component spec.
 *
 * The reusable Layer-1 floating-panel primitive: drag by header handle
 * (react-draggable@2.2.6), native CSS corner resize, viewport clamping so the
 * header can never leave the screen, dark-glass .simple-view-panel theme,
 * close chip, stacks above .gn-page-wrapper (z-index >= 100000).
 *
 * Asserts:
 *   - renders title + children + close chip in a .simple-view-panel shell,
 *   - inline z-index >= 100000 (the .gn-page-wrapper is 99999 — tooltip trap),
 *   - dragging the header moves the panel and fires onMove with the new position,
 *   - the dragged position is CLAMPED so the header stays inside the viewport,
 *   - the controlled size prop applies; a resize gesture end fires onResize,
 *   - the close chip fires onClose without starting a drag,
 *   - clampToViewport pure-function contract.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';

import {
    MovablePanel,
    clampToViewport,
    MOVABLE_PANEL_Z_INDEX
} from '../MovablePanel';

// Native events: react-draggable's drag-start rides React's synthetic
// onMouseDown (delegated at document level in React 16, so a bubbling native
// event triggers it), while its move/stop listeners are plain document
// listeners — native MouseEvents drive the whole gesture end-to-end.
const mouse = (target, type, x = 0, y = 0) => {
    target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
    }));
};

const dragHeader = (container, from, to) => {
    const header = container.querySelector('.sv-movable-panel-header');
    expect(header).toExist();
    mouse(header, 'mousedown', from.x, from.y);
    mouse(document, 'mousemove', to.x, to.y);
    mouse(document, 'mouseup', to.x, to.y);
};

describe('MovablePanel — TASK-2233', () => {
    let container;
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.removeChild(container);
    });

    const render = (props = {}) => {
        ReactDOM.render(
            <MovablePanel panelId="spec" title="Spec Panel" {...props}>
                <div className="spec-child">hello</div>
            </MovablePanel>,
            container
        );
        return container.querySelector('.sv-movable-panel');
    };

    // ── W2 adversarial finding R4 (epic 2425 W2.5) ──────────────────────────
    // "View account" on a refusal modal dismisses the dialog and opens this
    // panel IN ONE COMMIT. ModalHost's cleanup runs restoreFocus first, and
    // this panel had NO focus entry, so a keyboard user was left on the map
    // behind the panel they had just asked for.
    describe('focus entry (adversarial R4)', () => {
        it('focuses the first focusable control inside the panel on mount', () => {
            ReactDOM.render(
                <MovablePanel panelId="spec" title="Spec Panel" onClose={() => {}} autoFocus>
                    <button data-testid="body-first">first</button>
                    <button data-testid="body-second">second</button>
                </MovablePanel>,
                container
            );
            // The close chip is a button in the HEADER and comes first in DOM
            // order, so it is the legitimate first stop — assert focus is
            // INSIDE the panel rather than pinning one specific node, which
            // would break the moment the header gains another control.
            const panel = container.querySelector('.sv-movable-panel');
            expect(panel.contains(document.activeElement)).toBe(
                true,
                'focus stayed outside the panel — the keyboard user is still on the map behind it'
            );
            expect(document.activeElement).toNotBe(document.body);
        });

        it('falls back to the panel itself when it has no focusable content yet', () => {
            // e.g. an async tab still loading. tabIndex={-1} is what makes this
            // possible on a plain div.
            ReactDOM.render(
                <MovablePanel panelId="spec" title="Spec Panel" autoFocus>
                    <div>loading…</div>
                </MovablePanel>,
                container
            );
            const panel = container.querySelector('.sv-movable-panel');
            expect(panel.getAttribute('tabindex')).toBe('-1');
            expect(document.activeElement).toBe(panel);
        });

        it('does NOTHING without autoFocus — a legend must never steal the caret', () => {
            // Seven components share this primitive and several mount as a SIDE
            // EFFECT (DemRampLegend appears with a DEM layer;
            // ClickDisambiguationPanel on any ambiguous map click). A blanket
            // focus-on-mount would be a worse bug than the one R4 describes,
            // introduced while fixing it. Default OFF, and pinned here.
            const outside = document.createElement('button');
            document.body.appendChild(outside);
            outside.focus();
            expect(document.activeElement).toBe(outside);
            ReactDOM.render(
                <MovablePanel panelId="spec" title="Spec Panel" onClose={() => {}}>
                    <button data-testid="body-first">first</button>
                </MovablePanel>,
                container
            );
            expect(document.activeElement).toBe(
                outside, 'the panel stole focus without autoFocus'
            );
            document.body.removeChild(outside);
        });

        it('is NOT a focus trap — tabIndex -1 keeps the panel out of the tab order', () => {
            // The difference from ModalHost: this panel is non-modal and
            // draggable, and the customer must be able to Tab away from it.
            // There is no document keydown handler here at all.
            const panel = render({ onClose: () => {} });
            expect(panel.getAttribute('tabindex')).toBe('-1');
        });
    });

    it('renders title + children + close chip in a dark-glass movable panel', () => {
        const panel = render({ onClose: () => {} });
        expect(panel).toExist();
        // dark-glass theme = the .simple-view-panel shell class
        expect(panel.className).toInclude('simple-view-panel');
        expect(panel.getAttribute('data-testid')).toBe('movable-panel-spec');
        expect(container.querySelector('.sv-panel-header-title').textContent).toBe('Spec Panel');
        expect(container.querySelector('.spec-child').textContent).toBe('hello');
        expect(container.querySelector('.sv-panel-header-close')).toExist();
    });

    it('stacks above .gn-page-wrapper (inline z-index >= 100000)', () => {
        const panel = render();
        expect(Number(panel.style.zIndex)).toBeGreaterThanOrEqualTo(100000);
        expect(MOVABLE_PANEL_Z_INDEX).toBeGreaterThanOrEqualTo(100000);
    });

    it('drag by the header moves the panel and fires onMove with the new position', () => {
        const onMove = expect.createSpy();
        const panel = render({ defaultPosition: { x: 10, y: 10 }, onMove });
        dragHeader(container, { x: 50, y: 50 }, { x: 90, y: 70 });
        // delta (40, 20) from (10, 10) -> (50, 30)
        expect(onMove).toHaveBeenCalled();
        const pos = onMove.calls[onMove.calls.length - 1].arguments[0];
        expect(pos).toEqual({ x: 50, y: 30 });
        expect(panel.style.transform).toInclude('50px');
        expect(panel.style.transform).toInclude('30px');
    });

    it('clamps the dragged position so the header cannot leave the viewport (top-left)', () => {
        const onMove = expect.createSpy();
        const panel = render({ defaultPosition: { x: 10, y: 10 }, onMove });
        dragHeader(container, { x: 50, y: 50 }, { x: -500, y: -500 });
        expect(onMove).toHaveBeenCalled();
        const pos = onMove.calls[onMove.calls.length - 1].arguments[0];
        // header top can never go above the viewport
        expect(pos.y).toBe(0);
        // at least a sliver of the panel stays horizontally reachable
        expect(pos.x).toBeGreaterThanOrEqualTo(-(panel.offsetWidth - 48));
    });

    it('clamps the dragged position so the header cannot leave the viewport (bottom-right)', () => {
        const onMove = expect.createSpy();
        render({ defaultPosition: { x: 10, y: 10 }, onMove });
        dragHeader(container, { x: 50, y: 50 }, { x: 5000, y: 5000 });
        expect(onMove).toHaveBeenCalled();
        const pos = onMove.calls[onMove.calls.length - 1].arguments[0];
        expect(pos.x).toBeLessThanOrEqualTo(window.innerWidth - 48);
        expect(pos.y).toBeLessThanOrEqualTo(window.innerHeight - 40);
    });

    it('re-clamps a controlled position that is off-viewport (persisted from a larger window)', () => {
        const panel = render({ position: { x: 99999, y: 99999 } });
        // rendered transform must be clamped back inside the viewport
        const match = /translate\((-?[\d.]+)px[, ]+(-?[\d.]+)px\)/.exec(panel.style.transform);
        expect(match).toExist();
        expect(Number(match[1])).toBeLessThanOrEqualTo(window.innerWidth - 48);
        expect(Number(match[2])).toBeLessThanOrEqualTo(window.innerHeight - 40);
    });

    it('applies the controlled size prop', () => {
        const panel = render({ size: { width: 320, height: 240 } });
        expect(panel.style.width).toBe('320px');
        expect(panel.style.height).toBe('240px');
    });

    it('fires onResize with the measured size when a resize gesture ends', () => {
        const onResize = expect.createSpy();
        const panel = render({ onResize });
        // simulate the native CSS corner-resize result, then the gesture-end mouseup
        panel.style.width = '400px';
        panel.style.height = '222px';
        mouse(document, 'mouseup');
        expect(onResize).toHaveBeenCalled();
        const size = onResize.calls[onResize.calls.length - 1].arguments[0];
        expect(size.width).toBe(panel.offsetWidth);
        expect(size.height).toBe(panel.offsetHeight);
    });

    it('does not fire onResize on a plain click (size unchanged)', () => {
        const onResize = expect.createSpy();
        render({ onResize });
        mouse(document, 'mouseup');
        expect(onResize).toNotHaveBeenCalled();
    });

    it('close chip fires onClose (and does not start a drag)', () => {
        const onClose = expect.createSpy();
        const onMove = expect.createSpy();
        render({ onClose, onMove });
        const close = container.querySelector('.sv-panel-header-close');
        // TASK-2235 r2: the chip contains a glyphicon span, so the REAL
        // mousedown target is the chip's CHILD — the cancel selector must
        // match descendants too (the ".cls, .cls *" idiom), or pressing the
        // cross starts a drag.
        const glyph = close.querySelector('.glyphicon') || close;
        mouse(glyph, 'mousedown', 5, 5);
        mouse(document, 'mousemove', 60, 60);
        mouse(document, 'mouseup', 60, 60);
        close.click();
        expect(onClose).toHaveBeenCalled();
        expect(onMove).toNotHaveBeenCalled();
    });

    describe('clampToViewport (pure)', () => {
        const viewport = { width: 1000, height: 800 };
        it('leaves an inside-viewport position unchanged', () => {
            expect(clampToViewport({ x: 100, y: 100 }, 300, viewport)).toEqual({ x: 100, y: 100 });
        });
        it('clamps y so the header cannot go above the top', () => {
            expect(clampToViewport({ x: 100, y: -50 }, 300, viewport).y).toBe(0);
        });
        it('clamps y so the header strip stays above the bottom edge', () => {
            expect(clampToViewport({ x: 100, y: 9999 }, 300, viewport).y).toBe(800 - 40);
        });
        it('clamps x so a sliver stays reachable on the right', () => {
            expect(clampToViewport({ x: 9999, y: 100 }, 300, viewport).x).toBe(1000 - 48);
        });
        it('clamps x so a sliver stays reachable on the left', () => {
            expect(clampToViewport({ x: -9999, y: 100 }, 300, viewport).x).toBe(-(300 - 48));
        });
    });
});
