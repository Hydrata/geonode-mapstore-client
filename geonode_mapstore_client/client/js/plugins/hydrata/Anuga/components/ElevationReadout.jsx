/**
 * TASK-1857 (epic 1814 W3.3) — ElevationReadout
 *
 * Shows the real-time DEM elevation for the 2D map cursor position in the
 * MapFooter (`#mapstore-map-footer`).  Connected to
 * state.anuga.resources.cursorElevation which is written by cursorElevationEpic
 * (W3.2) on every debounced MOUSE_MOVE.
 *
 * Renders: "Elevation: 427.52 m"  (2 decimal places)
 * Hidden : when cursorElevation is null (no DEM loaded, cursor off-DEM, MOUSE_OUT)
 *
 * Styling: inherits the MapFooter's text colour/size (dark-glass theme).  A
 * minimal inline style pins the left-rail position inside the FlexBox fill gap
 * so it sits next to the ScaleBar/MousePosition readouts without overlapping.
 *
 * Mount point: anugaContainer.js portals this component into `#mapstore-map-footer`
 * using ReactDOM.createPortal (same pattern as the left-toolbar button portal).
 */
import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

/**
 * Pure presentational component — renders the elevation string or null.
 *
 * Exported (named) for unit testing.  The default export is the connected
 * version used by anugaContainer.
 */
export function ElevationReadout({ cursorElevation }) {
    if (cursorElevation === null || cursorElevation === undefined) {
        return null;
    }
    const formatted = Number(cursorElevation).toFixed(2);
    return (
        <span
            className="anuga-elevation-readout"
            style={{ padding: '0 8px', whiteSpace: 'nowrap' }}
        >
            {`Elevation: ${formatted} m`}
        </span>
    );
}

ElevationReadout.propTypes = {
    /** Float metres from cursorElevationEpic, or null/undefined to hide. */
    cursorElevation: PropTypes.number
};

ElevationReadout.defaultProps = {
    cursorElevation: null
};

const mapStateToProps = (state) => ({
    cursorElevation: state?.anuga?.resources?.cursorElevation ?? null
});

export default connect(mapStateToProps)(ElevationReadout);
