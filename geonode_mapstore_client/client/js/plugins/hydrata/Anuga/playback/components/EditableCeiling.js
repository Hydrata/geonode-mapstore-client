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
 */
import React from 'react';
const PropTypes = require('prop-types');

import { translateOr } from '../playbackI18n';

/** `≤ 1.5 m` — three significant-ish digits, no trailing zero noise. */
export function formatCeiling(value, unit) {
    if (!isFinite(value)) {
        return '—';
    }
    const n = Number(value.toFixed(3));
    return `≤ ${n}${unit ? ` ${unit}` : ''}`;
}

export default class EditableCeiling extends React.Component {
    static propTypes = {
        // The result quantity this ceiling belongs to. Carried through the
        // commit so editing shear's ceiling while depth is displayed cannot
        // write depth's — the override map is per-quantity.
        quantity: PropTypes.string,
        // The EFFECTIVE ceiling: the operator's override if there is one,
        // otherwise the store-derived maximum.
        value: PropTypes.number,
        unit: PropTypes.string,
        overridden: PropTypes.bool,
        disabled: PropTypes.bool,
        testid: PropTypes.string,
        // (quantity, number|null) — null means "restore the store's own value".
        onChange: PropTypes.func
    };

    static defaultProps = {
        testid: 'ceiling',
        unit: '',
        overridden: false,
        disabled: false
    };

    static contextTypes = { messages: PropTypes.object };

    state = { editing: false, draft: '' };

    tr(msgId, fallback) {
        return translateOr(this.context && this.context.messages, msgId, fallback);
    }

    beginEdit = () => {
        if (this.props.disabled) {
            return;
        }
        const { value } = this.props;
        this.setState({ editing: true, draft: isFinite(value) ? String(Number(value.toFixed(3))) : '' });
    };

    /* Commit is idempotent: Enter fires it, and the blur that Enter causes
       would fire it again. `editing` is cleared first and guards the second. */
    commit = () => {
        if (!this.state.editing) {
            return;
        }
        const { draft } = this.state;
        this.setState({ editing: false, draft: '' });
        const parsed = draft === '' ? null : Number(draft);
        this.props.onChange(this.props.quantity, parsed === null || isNaN(parsed) ? null : parsed);
    };

    cancel = () => {
        this.setState({ editing: false, draft: '' });
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
        const { value, unit, overridden, disabled, testid, quantity } = this.props;
        const label = this.tr('hydrata.playback.ceiling', 'Colour scale ceiling');
        if (this.state.editing) {
            return (
                <span className="sv-playback-ceiling" data-testid={`${testid}-group`}>
                    <input
                        type="number"
                        className="sv-playback-ceiling-input"
                        data-testid={`${testid}-input`}
                        min={0}
                        step="any"
                        value={this.state.draft}
                        aria-label={label}
                        title={label}
                        autoFocus
                        onChange={(e) => this.setState({ draft: e.target.value })}
                        onKeyDown={this.onKeyDown}
                        onBlur={this.commit}
                    />
                </span>
            );
        }
        return (
            <span className="sv-playback-ceiling" data-testid={`${testid}-group`}>
                <button
                    type="button"
                    className={`sv-playback-ceiling-value${overridden ? ' is-override' : ''}`}
                    data-testid={testid}
                    disabled={disabled}
                    aria-label={label}
                    title={this.tr(
                        'hydrata.playback.ceilingTooltip',
                        'Top of the colour ramp for this result quantity — click to change'
                    )}
                    onClick={this.beginEdit}
                >
                    {formatCeiling(value, unit)}
                </button>
                {overridden && !disabled ? (
                    <button
                        type="button"
                        className="sv-playback-ceiling-reset"
                        data-testid={`${testid}-reset`}
                        aria-label={this.tr('hydrata.playback.ceilingReset', 'Restore the value the store shipped')}
                        title={this.tr('hydrata.playback.ceilingReset', 'Restore the value the store shipped')}
                        onClick={() => this.props.onChange(quantity, null)}
                    >
                        {this.tr('hydrata.playback.ceilingResetShort', '↺')}
                    </button>
                ) : null}
            </span>
        );
    }
}
