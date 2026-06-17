import React from 'react';
import PropTypes from 'prop-types';

/**
 * HGevalPanelFooter — the action-row footer shared by the HGeval input panel
 * and report display. A flex space-between row with a top divider, sitting
 * flush at the bottom of the panel body.
 *
 * TASK-1766 (epic-1758 W2 polish, item d) — extracted to dedup the verbatim
 * inline footer block previously duplicated in hgevalInputPanel.js and
 * hgevalReportDisplay.js. Renders the identical markup/style; children are the
 * footer buttons (cancel/generate, new-evaluation/save, etc.).
 */
const HGevalPanelFooter = ({ children }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '8px',
        borderTop: '1px solid var(--sv-section-border, rgba(255, 255, 255, 0.6))',
        marginTop: '4px'
    }}>
        {children}
    </div>
);

HGevalPanelFooter.propTypes = {
    children: PropTypes.node
};

export default HGevalPanelFooter;
