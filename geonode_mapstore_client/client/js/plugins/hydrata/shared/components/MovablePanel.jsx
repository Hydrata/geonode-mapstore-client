/**
 * TASK-2233 — MovablePanel: the reusable Hydrata floating-panel primitive
 * (drag + resize), SimpleView dark-glass themed. First consumer: the
 * stand-alone dynamic-DEM legend (Anuga FloatingDemLegendPanel); TASK-2046
 * (static result-raster legends) is the planned second consumer.
 *
 * - Drag: by the header handle only, via react-draggable@2.2.6 (already a
 *   MapStore2 dep — same primitive core Dialog.jsx uses; npm install is
 *   broken in this repo so no new drag/resize package may be added).
 * - Resize: native CSS `resize: both` corner handle on the panel element
 *   (movablePanel.css). The gesture end is detected on document mouseup by
 *   comparing measured size — no resize library.
 * - Clamping: the header strip can never leave the viewport. Live drags are
 *   bounded (react-draggable `bounds`), and both controlled and reported
 *   positions re-clamp through the same clampToViewport() so a position
 *   persisted from a larger window can't strand the panel off-screen.
 * - Stacking: .gn-page-wrapper is z-index 99999, so anything floating must
 *   stack at >= 100000 or it renders BEHIND the app (2026-07-13 tooltip
 *   live-fix). The z-index rides an inline style so no sheet can lose it.
 * - Persistence: the panel is stateless about position/size when `position`/
 *   `size` are provided (controlled); consumers persist via onMove/onResize
 *   (the Anuga ui slice keys them per panelId). Uncontrolled fallback keeps
 *   the primitive usable standalone.
 */
import React from 'react';
import PropTypes from 'prop-types';
import Draggable from 'react-draggable';
import { PanelHeader } from '../../SimpleView/components/primitives';
import './movablePanel.css';

export const MOVABLE_PANEL_Z_INDEX = 100000;
// Horizontal sliver of the panel that must stay reachable on-screen.
const MIN_VISIBLE_X = 48;
// Vertical strip kept on-screen — approximately the header height, so the
// drag handle itself can never be lost above/below the viewport.
const HEADER_SAFE_H = 40;

// Focus-entry candidates (W2 adversarial finding R4). Same list ModalHost
// uses, kept as its own copy rather than shared: importing a paywall-plugin
// constant into a shared primitive would invert the dependency direction, and
// the two lists are allowed to diverge (a trap needs Tab-cycle candidates; this
// only needs somewhere sensible to land).
const FOCUSABLE_IN_PANEL = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Clamp a {x, y} panel position so the header strip stays inside the
 * viewport: y in [0, viewportH - HEADER_SAFE_H], x leaves at least
 * MIN_VISIBLE_X px of the panel reachable on either side.
 *
 * @param {{x: number, y: number}} position - the raw position
 * @param {number} panelWidth - current panel width in px
 * @param {{width: number, height: number}} [viewport] - defaults to window
 */
export function clampToViewport(position, panelWidth, viewport) {
    const vw = viewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 0);
    const vh = viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0);
    const w = Math.max(panelWidth || MIN_VISIBLE_X, MIN_VISIBLE_X);
    const minX = -(w - MIN_VISIBLE_X);
    const maxX = Math.max(minX, vw - MIN_VISIBLE_X);
    const maxY = Math.max(0, vh - HEADER_SAFE_H);
    return {
        x: Math.min(Math.max(position?.x ?? 0, minX), maxX),
        y: Math.min(Math.max(position?.y ?? 0, 0), maxY)
    };
}

export class MovablePanel extends React.Component {
    static propTypes = {
        /** Stable id — used for the data-testid and by consumers as the persistence key. */
        panelId: PropTypes.string.isRequired,
        title: PropTypes.node,
        /** Close chip handler; omit to render no close control. */
        onClose: PropTypes.func,
        /** Controlled position (persisted upstream). Omit for uncontrolled. */
        position: PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }),
        /** Initial position when uncontrolled (clamped). Default {x:0,y:0}. */
        defaultPosition: PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }),
        /** Controlled size (persisted upstream). Omit to size to content. */
        size: PropTypes.shape({ width: PropTypes.number, height: PropTypes.number }),
        /** Fired with the CLAMPED {x,y} when a drag ends. */
        onMove: PropTypes.func,
        /** Fired with the measured {width,height} when a resize gesture ends. */
        onResize: PropTypes.func,
        zIndex: PropTypes.number,
        className: PropTypes.string,
        children: PropTypes.node,
        /**
         * Move keyboard focus into the panel on mount (W2 adversarial R4).
         * Default OFF — see enterFocus()'s docstring for why a blanket
         * focus-on-mount would be a regression for the legend/disambiguation
         * consumers. Set it where the panel is the DESTINATION of a user
         * action, not where it appears as a side effect.
         */
        autoFocus: PropTypes.bool
    };

    static defaultProps = {
        zIndex: MOVABLE_PANEL_Z_INDEX,
        autoFocus: false
    };

    componentDidMount() {
        this._lastSize = this.measure();
        if (typeof document !== 'undefined') {
            document.addEventListener('mouseup', this.onDocumentMouseUp);
        }
        if (this.props.autoFocus) {
            this.enterFocus();
        }
    }

    /**
     * FOCUS ENTRY (W2 adversarial finding R4, epic 2425 W2.5).
     *
     * The "View account" route out of a refusal modal dismisses the dialog and
     * opens this panel IN ONE COMMIT. ModalHost's cleanup runs restoreFocus
     * first, and this panel had no focus entry at all, so a keyboard user
     * ended up with focus back on the map behind a panel they had just asked
     * for — they had to Tab through the whole page to reach it.
     *
     * OPT-IN (`autoFocus`), NOT the default, and that is deliberate. Seven
     * components use this primitive, and several mount as a SIDE EFFECT rather
     * than as the destination of a user action: DemRampLegend is a legend that
     * appears with a DEM layer, ClickDisambiguationPanel appears on any
     * ambiguous map click. A blanket focus-on-mount would let a legend yank the
     * caret out of whatever the customer was typing — a worse bug than the one
     * R4 describes, introduced while fixing it. Turn it on only where the panel
     * IS the thing the user just asked for.
     *
     * Focuses the first focusable control inside the panel, falling back to the
     * panel itself (hence tabIndex={-1} on the container, which makes an
     * otherwise non-focusable div a valid programmatic target without adding it
     * to the tab order).
     *
     * NOT a focus TRAP, deliberately: this is a non-modal, draggable panel the
     * customer is meant to work alongside. Tab must be able to leave it. That
     * is the whole difference between this and ModalHost.
     */
    enterFocus() {
        if (typeof document === 'undefined' || !this.panelEl) return;
        const first = this.panelEl.querySelector(FOCUSABLE_IN_PANEL);
        const target = first || this.panelEl;
        if (typeof target.focus === 'function') {
            target.focus();
        }
    }

    componentDidUpdate(prevProps) {
        // A controlled size change re-baselines the measurement so the next
        // unrelated mouseup doesn't misread it as a user resize gesture.
        if (prevProps.size !== this.props.size) {
            this._lastSize = this.measure();
        }
    }

    componentWillUnmount() {
        if (typeof document !== 'undefined') {
            document.removeEventListener('mouseup', this.onDocumentMouseUp);
        }
    }

    // The native CSS resize handle gives no JS event, so a gesture "ends"
    // whenever a mouseup lands anywhere and the measured size has changed.
    onDocumentMouseUp = () => {
        const measured = this.measure();
        if (!measured) return;
        const last = this._lastSize;
        this._lastSize = measured;
        if (last
            && (Math.abs(measured.width - last.width) >= 1 || Math.abs(measured.height - last.height) >= 1)
            && this.props.onResize) {
            this.props.onResize(measured);
        }
    };

    onDragStop = (e, data) => {
        if (this.props.onMove) {
            this.props.onMove(clampToViewport({ x: data.x, y: data.y }, this.getWidth()));
        }
    };

    getWidth() {
        return this.props.size?.width || this.panelEl?.offsetWidth || 300;
    }

    // Live-drag bounds, expressed in translation coords (the panel is fixed at
    // top:0/left:0 so translation == viewport position). Kept in lockstep with
    // clampToViewport so what the user sees mid-drag is what gets persisted.
    getBounds() {
        if (typeof window === 'undefined') return false;
        const w = Math.max(this.getWidth(), MIN_VISIBLE_X);
        return {
            left: -(w - MIN_VISIBLE_X),
            top: 0,
            right: Math.max(-(w - MIN_VISIBLE_X), window.innerWidth - MIN_VISIBLE_X),
            bottom: Math.max(0, window.innerHeight - HEADER_SAFE_H)
        };
    }

    measure() {
        return this.panelEl
            ? { width: this.panelEl.offsetWidth, height: this.panelEl.offsetHeight }
            : null;
    }

    render() {
        const { panelId, title, onClose, position, defaultPosition, size, zIndex, className, children } = this.props;
        const controlledPosition = position ? clampToViewport(position, this.getWidth()) : null;
        const style = {
            zIndex,
            ...(size?.width ? { width: size.width } : {}),
            ...(size?.height ? { height: size.height } : {})
        };
        return (
            <Draggable
                handle=".sv-movable-panel-header, .sv-movable-panel-header *"
                cancel=".sv-panel-header-close, .sv-panel-header-close *"
                position={controlledPosition}
                defaultPosition={clampToViewport(defaultPosition || { x: 0, y: 0 }, this.getWidth())}
                bounds={this.getBounds()}
                onStop={this.onDragStop}
            >
                <div
                    ref={(el) => { this.panelEl = el; }}
                    className={'simple-view-panel sv-movable-panel' + (className ? ' ' + className : '')}
                    style={style}
                    data-testid={`movable-panel-${panelId}`}
                    // R4 — a programmatic focus target for enterFocus()'s
                    // fallback when the panel has no focusable content yet
                    // (e.g. an async tab still loading). -1 keeps it OUT of the
                    // tab order, so this adds no stop for mouse users.
                    tabIndex={-1}
                >
                    <PanelHeader
                        title={title}
                        onClose={onClose}
                        extraClassName="sv-movable-panel-header"
                    />
                    <div className="sv-movable-panel-body">
                        {children}
                    </div>
                </div>
            </Draggable>
        );
    }
}

export default MovablePanel;
