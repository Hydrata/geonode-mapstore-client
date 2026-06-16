import React from "react";
import PropTypes from 'prop-types';

/**
 * EmptyState — centred "nothing here yet" block.
 *
 * Phase-0 (TASK-1732) shared primitive: collapses the divergent per-panel empty
 * blocks into one token-backed widget (rule-of-three met by these consumers):
 *   - Anuga Scenarios  .anuga-scenario-rail-empty  (glyph + heading + subcopy)
 *   - TaskMonitor      .sv-tm-empty                (bare text)
 *   - Terrain (TW)     .tw-empty-hint              ("No analysis surfaces yet…")
 *
 * Best-of-breed source: anuga.css `.anuga-scenario-rail-empty` — a centred
 * glyph + heading + subcopy column. The dim text colour is composed from the
 * existing `--sv-text-dim` token via an inline `style`, so the primitive is
 * self-styled WITHOUT touching tokens.css or any panel stylesheet, and is
 * cascade-proof (inline style beats a later-loaded equal-specificity sheet).
 * Stable `sv-empty-state*` class hooks are still emitted for a later CSS pass.
 *
 * Each visual part is optional, so the primitive degrades from the rich
 * three-part Anuga rail-empty down to the bare TaskMonitor text:
 *   <EmptyState heading="No processes" />               (text-only)
 *   <EmptyState glyph="glyphicon-list-alt"              (full rail-empty)
 *               heading="No scenarios yet">
 *       Create one to begin.
 *   </EmptyState>
 *
 * Themed via --sv-* tokens only; no hardcoded panel-chrome colour values.
 */

const DIM = 'var(--sv-text-dim, rgba(255, 255, 255, 0.68))';

const wrapStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '18px 12px',
    color: DIM
};

const glyphStyle = {
    fontSize: '28px',
    marginBottom: '8px',
    opacity: 0.7
};

const headingStyle = {
    margin: '0 0 4px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--sv-text, rgba(255, 255, 255, 0.85))'
};

const subcopyStyle = {
    margin: 0,
    fontSize: '11.5px',
    color: DIM
};

const EmptyState = ({glyph, heading, children, extraClassName, style}) => {
    const className = "sv-empty-state" + (extraClassName ? " " + extraClassName : "");
    const hasSubcopy = children !== undefined && children !== null && children !== false;
    return (
        <div className={className} style={{...wrapStyle, ...style}}>
            {glyph ? (
                <span
                    className={`sv-empty-state-glyph glyphicon ${glyph}`}
                    style={glyphStyle}
                    aria-hidden="true"
                />
            ) : null}
            {heading ? (
                <h5 className="sv-empty-state-heading" style={headingStyle}>{heading}</h5>
            ) : null}
            {hasSubcopy ? (
                <p className="sv-empty-state-subcopy" style={subcopyStyle}>{children}</p>
            ) : null}
        </div>
    );
};

EmptyState.propTypes = {
    /** Glyphicon modifier class (e.g. "glyphicon-list-alt"). Omit for text-only. */
    glyph: PropTypes.string,
    /** Heading line (e.g. "No scenarios yet"). */
    heading: PropTypes.node,
    /** Subcopy / call-to-action rendered under the heading. */
    children: PropTypes.node,
    /** Per-panel variant class (e.g. "tw-empty-hint") carried alongside sv-empty-state. */
    extraClassName: PropTypes.string,
    /** Inline style pass-through merged over the token-backed defaults. */
    style: PropTypes.object
};

export {EmptyState};
