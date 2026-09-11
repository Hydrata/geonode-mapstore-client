/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * EditableCeiling — the colour-scale CEILING for one result quantity
 * (TASK-2751, W6.3, epic 2706).
 *
 * NAMING, which is load-bearing here. Epic 2706 reserves the word "max" for
 * the temporal-max ENVELOPE — the in-browser equivalent of the `*_max.tif`
 * rasters, glossary "max-value raster" — which TASK-2752 adds to the playback
 * store. This control is a different number entirely: the top of the rendered
 * colour ramp, a display setting with no physical meaning. Two numbers both
 * labelled "max" on the same bar is precisely the confusion the grill of
 * 2026-08-13 set out to prevent, so this one renders as `≤ 1.5 m` and the
 * string "max" appears nowhere a user can read it.
 *
 * ONE component, mounted TWICE — on the control bar and as the legend's
 * ceiling row — because the previous arrangement (a bare number input on the
 * bar, a stop list in the legend) let the two drift.
 *
 * TASK-2784 (W7) changed what the row sits next to. It used to be the odd one
 * out: the stop list was CLIPPED at the ceiling, so its top row was the
 * largest SLD stop below the ceiling and never the ceiling itself, and this
 * row existed partly to show the number nothing else did. Now a reader-set
 * ceiling stretches the ramp, so the top stop IS the ceiling and the two
 * agree. The row stays because it is the place you TYPE — agreement is the
 * point, not redundancy.
 *
 * Component-local edit state is deliberate. A ceiling being typed is not
 * application state — it has no meaning until it is committed, it must not
 * survive a remount half-typed, and it must not re-render the mesh on every
 * keystroke. The COMMITTED value lives in playbackController's
 * `colorMaxOverride`, keyed per quantity, exactly as TASK-2744 left it.
 *
 * TASK-3076 pairs it with the colour-scale FLOOR (glossary "Colour-scale
 * floor"): the row now reads `≥ 0.1 m … ≤ 1.5 m` — TWO click targets joined
 * by a static ellipsis, each with its own input and reset — and the edit
 * gestures (Enter/blur commit, Escape cancel, empty = clear, 3-s.f. seed with
 * an unchanged-blur no-op) live ONCE, in the inner EditableBound. The floor is
 * stored as typed (`colorFloorOverride`); whether it TAKES EFFECT is decided
 * by playbackController.isColorFloorActive, which the parent passes in as
 * `floorActive` — this component never compares a floor to anything. An
 * inert-but-stored floor is shown muted, with a cause-neutral title and a
 * reset, so the reader can see it and remove it. The word "min" appears
 * nowhere, for the same reason "max" does not.
 */
import React from 'react';
const PropTypes = require('prop-types');

import { translateOr } from '../playbackI18n';
import { formatRampValue } from '../playbackColormap';

/** `≤ 1.5 m` — the shared 3-s.f. formatter (TASK-3076 AC1) plus the prefix. */
export function formatCeiling(value, unit) {
    if (!Number.isFinite(value)) {
        return '—';
    }
    return `≤ ${formatRampValue(value)}${unit ? ` ${unit}` : ''}`;
}

/** `≥ 0.1 m`, or `≥ —` while no floor is stored (TASK-3076 AC8). */
export function formatFloor(value, unit) {
    if (!Number.isFinite(value)) {
        return '≥ —';
    }
    return `≥ ${formatRampValue(value)}${unit ? ` ${unit}` : ''}`;
}

/**
 * One editable bound of the range — a button that swaps for a number input.
 * Holds the edit state; the parent decides the text, the classes and the
 * titles, and receives `onChange(quantity, number|null)`.
 */
class EditableBound extends React.Component {
    static propTypes = {
        quantity: PropTypes.string,
        // the number the box SEEDS from (may be non-finite: seeds empty)
        value: PropTypes.number,
        text: PropTypes.string,
        className: PropTypes.string,
        label: PropTypes.string,
        title: PropTypes.string,
        disabled: PropTypes.bool,
        testid: PropTypes.string,
        // `min` on the input, or undefined for none (a stage floor is in datum
        // metres and can be negative — the FLOOR input must not carry one).
        min: PropTypes.number,
        showReset: PropTypes.bool,
        resetLabel: PropTypes.string,
        resetGlyph: PropTypes.string,
        onChange: PropTypes.func
    };

    static defaultProps = { disabled: false, showReset: false, className: '' };

    // `seed` is what the box opened with. TASK-3076 AC2: a blur that leaves
    // the draft equal to its seed commits NOTHING — the seed is a 3-s.f.
    // DISPLAY string, and committing it would round the stored value (and,
    // for a never-overridden ceiling, silently CREATE an override).
    state = { editing: false, draft: '', seed: '' };

    beginEdit = () => {
        if (this.props.disabled) {
            return;
        }
        const { value } = this.props;
        const seed = Number.isFinite(value) ? formatRampValue(value) : '';
        this.setState({ editing: true, draft: seed, seed });
    };

    /* Commit is idempotent: Enter fires it, and the blur that Enter causes
       would fire it again. `editing` is cleared first and guards the second.
       An UNCHANGED draft is a no-op (AC2) — only a typed edit commits. The
       comparison is NUMERIC, not string: retyping the seed as '16.90' or
       '1.5e0' is not an edit, and committing it would create the very
       override AC2 exists to prevent. */
    commit = () => {
        if (!this.state.editing) {
            return;
        }
        const { draft, seed } = this.state;
        this.setState({ editing: false, draft: '', seed: '' });
        if (draft === seed || (draft !== '' && seed !== '' && Number(draft) === Number(seed))) {
            return;
        }
        const parsed = draft === '' ? null : Number(draft);
        this.props.onChange(this.props.quantity, parsed === null || isNaN(parsed) ? null : parsed);
    };

    cancel = () => {
        this.setState({ editing: false, draft: '', seed: '' });
    };

    onKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();   // must not also close the drawer behind it
            this.cancel();
        }
    };

    render() {
        const { text, className, label, title, disabled, testid, quantity, min, showReset, resetLabel, resetGlyph } = this.props;
        if (this.state.editing) {
            return (
                <input
                    type="number"
                    className="sv-playback-ceiling-input"
                    data-testid={`${testid}-input`}
                    min={min}
                    step="any"
                    value={this.state.draft}
                    aria-label={label}
                    title={label}
                    autoFocus
                    onChange={(e) => this.setState({ draft: e.target.value })}
                    onKeyDown={this.onKeyDown}
                    onBlur={this.commit}
                />
            );
        }
        return (
            <React.Fragment>
                <button
                    type="button"
                    className={`sv-playback-ceiling-value${className ? ` ${className}` : ''}`}
                    data-testid={testid}
                    disabled={disabled}
                    aria-label={label}
                    title={title}
                    onClick={this.beginEdit}
                >
                    {text}
                </button>
                {showReset && !disabled ? (
                    <button
                        type="button"
                        className="sv-playback-ceiling-reset"
                        data-testid={`${testid}-reset`}
                        aria-label={resetLabel}
                        title={resetLabel}
                        onClick={() => this.props.onChange(quantity, null)}
                    >
                        {resetGlyph}
                    </button>
                ) : null}
            </React.Fragment>
        );
    }
}

export default class EditableCeiling extends React.Component {
    static propTypes = {
        // The result quantity this range belongs to. Carried through the
        // commit so editing shear's ceiling while depth is displayed cannot
        // write depth's — the override maps are per-quantity.
        quantity: PropTypes.string,
        // The EFFECTIVE ceiling: the operator's override if there is one,
        // otherwise the store-derived maximum.
        value: PropTypes.number,
        unit: PropTypes.string,
        overridden: PropTypes.bool,
        disabled: PropTypes.bool,
        testid: PropTypes.string,
        // (quantity, number|null) — null means "restore the store's own value".
        onChange: PropTypes.func,
        // TASK-3076 — the STORED floor for this quantity (undefined = none)...
        floor: PropTypes.number,
        // ...and whether it takes effect (playbackController.isColorFloorActive).
        floorActive: PropTypes.bool,
        // (quantity, number|null) — null clears the floor.
        onChangeFloor: PropTypes.func
    };

    static defaultProps = {
        testid: 'ceiling',
        unit: '',
        overridden: false,
        disabled: false,
        floorActive: false,
        onChange: () => {},
        onChangeFloor: () => {}
    };

    static contextTypes = { messages: PropTypes.object };

    tr(msgId, fallback) {
        return translateOr(this.context && this.context.messages, msgId, fallback);
    }

    render() {
        const { value, unit, overridden, disabled, testid, quantity, floor, floorActive, onChange, onChangeFloor } = this.props;
        const ceilingLabel = this.tr('hydrata.playback.ceiling', 'Colour scale ceiling');
        const floorLabel = this.tr('hydrata.playback.floor', 'Colour scale floor');
        // Number.isFinite, not the coercing global: null must read as "none",
        // not as a stored floor of 0.
        const floorStored = Number.isFinite(floor);
        const floorClass = floorStored ? (floorActive ? 'is-override' : 'is-inert') : '';
        const floorTitle = floorStored && !floorActive
            ? this.tr('hydrata.playback.floorInert', 'Not applied: outside the colour scale')
            : this.tr('hydrata.playback.floorTooltip', 'Bottom of the colour ramp for this result quantity — values below it are hidden — click to change');
        const resetGlyph = this.tr('hydrata.playback.ceilingResetShort', '↺');
        return (
            <span className="sv-playback-ceiling sv-playback-range" data-testid={`${testid}-group`}>
                <EditableBound
                    testid={`${testid}-floor`}
                    quantity={quantity}
                    value={floorStored ? floor : NaN}
                    text={formatFloor(floorStored ? floor : NaN, unit)}
                    className={`sv-playback-floor-value${floorClass ? ` ${floorClass}` : ''}`}
                    label={floorLabel}
                    title={floorTitle}
                    disabled={disabled}
                    showReset={floorStored}
                    resetLabel={this.tr('hydrata.playback.floorReset', 'Remove the floor')}
                    resetGlyph={resetGlyph}
                    onChange={onChangeFloor}
                />
                <span className="sv-playback-range-sep" aria-hidden="true">…</span>
                <EditableBound
                    testid={testid}
                    quantity={quantity}
                    value={value}
                    text={formatCeiling(value, unit)}
                    className={overridden ? 'is-override' : ''}
                    label={ceilingLabel}
                    title={this.tr(
                        'hydrata.playback.ceilingTooltip',
                        'Top of the colour ramp for this result quantity — click to change'
                    )}
                    disabled={disabled}
                    min={0}
                    showReset={overridden}
                    resetLabel={this.tr('hydrata.playback.ceilingReset', 'Restore the value the store shipped')}
                    resetGlyph={resetGlyph}
                    onChange={onChange}
                />
            </span>
        );
    }
}
