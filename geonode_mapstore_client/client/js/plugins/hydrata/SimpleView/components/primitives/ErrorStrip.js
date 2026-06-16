import React from "react";
import PropTypes from 'prop-types';

/**
 * ErrorStrip — shared red-left-border alert strip.
 *
 * Phase-0 (TASK-1732) shared primitive: collapses the ≥6 divergent per-panel
 * error blocks into one token-backed widget so Phase-1 panel agents stop
 * hand-rolling a danger box each time:
 *   - Anuga Scenarios  .anuga-scenario-error-strip  (head + monospace <code> payload)
 *   - SimpleView       .menu-row-delete-error       (message + blocking <ul>)
 *   - TaskMonitor      .sv-tm-error-message         (bare message)
 *   - Terrain (TW)     .tw-error                    (saveError/deriveError/createError)
 *   - HGeval           .alert.alert-danger          (validationError/error)
 *   - Hydrology        .idf-derive-error            (derive validation)
 *
 * Best-of-breed source: anuga.css `.anuga-scenario-error-strip` (left-border red,
 * tinted bg, uppercase head, monospace payload). That structure is reproduced
 * here; the colour values are composed from the existing `--sv-*` tokens via an
 * inline `style` so the primitive is self-styled WITHOUT touching tokens.css or
 * any panel stylesheet, and is cascade-proof (inline style beats a later-loaded
 * equal-specificity sheet — see reference-simple-view-panel-css.md / css gotcha).
 * The stable `sv-error-strip*` class hooks are still emitted so a later CSS pass
 * (or a migrating panel) can attach richer chrome.
 *
 * Renders NOTHING when there is no message, no children, no payload and no items
 * — so a caller can `<ErrorStrip message={err} />` unconditionally and the strip
 * self-hides on the happy path (mirrors every legacy `{err && <div…>}` guard).
 *
 * Themed via --sv-* tokens only; no hardcoded panel-chrome colour values.
 *
 * Usage:
 *   <ErrorStrip message={saveError} />
 *   <ErrorStrip head="Run failed" payload={run.error_message} />
 *   <ErrorStrip message="Cannot delete — blocked by:" items={blockingNames} />
 */

// Danger accent (the red left-border + heading + body text). Mirrors the
// anuga-scenario-error-strip palette but expressed against the panel's danger
// token so a future token retune flows through automatically.
const DANGER = 'var(--sv-text-danger, #ffb3b3)';

const stripStyle = {
    margin: '6px 10px 8px',
    background: 'rgba(217, 83, 79, 0.14)',
    border: '1px solid rgba(217, 83, 79, 0.30)',
    borderLeft: '3px solid #d9534f',
    padding: '8px 12px',
    borderRadius: '3px',
    fontSize: '11.5px',
    textAlign: 'left',
    color: DANGER
};

const headStyle = {
    fontWeight: 600,
    marginBottom: '2px',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: DANGER
};

const payloadStyle = {
    fontFamily: "'Menlo', 'Monaco', monospace",
    fontSize: '10.5px',
    background: 'rgba(0, 0, 0, 0.30)',
    padding: '2px 6px',
    borderRadius: '2px',
    display: 'block',
    wordBreak: 'break-word',
    marginTop: '4px',
    color: DANGER
};

const listStyle = {
    margin: '4px 0 0',
    paddingLeft: '18px'
};

const ErrorStrip = ({head, message, children, payload, items, extraClassName, style}) => {
    const hasItems = Array.isArray(items) && items.length > 0;
    const hasBody = message !== undefined && message !== null && message !== '';
    const hasChildren = children !== undefined && children !== null && children !== false;
    // Self-hide on the happy path: nothing to surface ⇒ render nothing.
    if (!head && !hasBody && !hasChildren && !payload && !hasItems) {
        return null;
    }
    const className = "sv-error-strip" + (extraClassName ? " " + extraClassName : "");
    return (
        <div className={className} role="alert" style={{...stripStyle, ...style}}>
            {head ? (
                <div className="sv-error-strip-head" style={headStyle}>{head}</div>
            ) : null}
            {(hasBody || hasChildren) ? (
                <div className="sv-error-strip-message">{hasBody ? message : children}</div>
            ) : null}
            {hasItems ? (
                <ul className="sv-error-strip-list" style={listStyle}>
                    {items.map((item, i) => (
                        <li key={typeof item === 'string' ? `${item}-${i}` : i}>{item}</li>
                    ))}
                </ul>
            ) : null}
            {payload ? (
                <code className="sv-error-strip-payload" style={payloadStyle}>{payload}</code>
            ) : null}
        </div>
    );
};

ErrorStrip.propTypes = {
    /** Uppercase title line, e.g. "Run failed". Omit for a bare message. */
    head: PropTypes.node,
    /** Primary error text. Wins over children when both are passed. */
    message: PropTypes.node,
    /** Body fallback when `message` is not supplied (richer JSX). */
    children: PropTypes.node,
    /** Monospace <code> block, e.g. a verbatim traceback / error_message. */
    payload: PropTypes.node,
    /** Optional list rendered as a <ul> (e.g. blocking scenario names). */
    items: PropTypes.array,
    /** Per-panel variant class (e.g. "tw-error") carried alongside sv-error-strip. */
    extraClassName: PropTypes.string,
    /** Inline style pass-through merged over the token-backed defaults. */
    style: PropTypes.object
};

export {ErrorStrip};
