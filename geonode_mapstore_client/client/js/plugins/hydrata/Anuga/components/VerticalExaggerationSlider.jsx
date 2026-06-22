/**
 * TASK-1869 (epic 1814 W5.4) — VerticalExaggerationSlider
 *
 * A dark-glass SimpleView floating panel that lets the user adjust the Cesium 3D
 * terrain vertical exaggeration (1× = real-world scale; 5× = maximum amplified).
 *
 * Design:
 *   - Reuses the OpacitySlider primitive (react-nouislider, sv-* tokens).
 *   - The slider range is 1..5 in steps of 0.1. Default = 1.0 (no exaggeration).
 *   - Dispatches updateMapOptions({ verticalExaggeration: value }) (core action).
 *   - The core Map.jsx (D10 sanctioned edit, TASK-1869) reads
 *     mapOptions.verticalExaggeration and applies it to scene.verticalExaggeration
 *     on BOTH creation and prop-update, so changes are reflected in real time.
 *   - Gated on isCesium(state): hidden in 2D / OpenLayers mode.
 *   - Mounted at the container level (anugaContainer.js) so the panel survives
 *     menu open/close — same pattern as TerrainBboxPanel and TerrainProfilePanel.
 *
 * Cesium reference: Cesium.d.ts:41719 — scene.verticalExaggeration: number.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { isCesium } from '../../../../../MapStore2/web/client/selectors/maptype';
import { mapSelector } from '../../../../../MapStore2/web/client/selectors/map';
import { updateMapOptions } from '../../../../../MapStore2/web/client/actions/map';
import '../../SimpleView/simpleView.css';
import '../anuga.css';

const Slider = require('react-nouislider');

// Slider range: 1× (real scale) to 5× (maximum amplified).
// Documented as the product-default range. A future operator can widen this by
// changing the constants — the D10 core edit has no upper-bound constraint.
export const VERT_EXAG_MIN = 1;
export const VERT_EXAG_MAX = 5;
export const VERT_EXAG_DEFAULT = 1.0;
export const VERT_EXAG_STEP = 0.1;

/**
 * VerticalExaggerationSliderClass — pure presentational + dispatch component.
 *
 * Visible only in Cesium 3D mode (gated by `visible` prop).
 * Dispatches updateMapOptions({ verticalExaggeration }) on slider change.
 */
export class VerticalExaggerationSliderClass extends React.Component {
    static propTypes = {
        visible: PropTypes.bool,
        verticalExaggeration: PropTypes.number,
        onChangeExaggeration: PropTypes.func
    };

    static defaultProps = {
        visible: false,
        verticalExaggeration: VERT_EXAG_DEFAULT
    };

    handleChange = (values) => {
        const raw = Array.isArray(values) ? values[0] : values;
        const v = parseFloat(raw);
        if (!isNaN(v) && this.props.onChangeExaggeration) {
            this.props.onChangeExaggeration(v);
        }
    };

    render() {
        if (!this.props.visible) return null;
        const current = this.props.verticalExaggeration ?? VERT_EXAG_DEFAULT;
        return (
            <div
                className="sv-vertical-exaggeration-panel"
                data-testid="vertical-exaggeration-panel"
                style={{
                    position: 'absolute',
                    bottom: 52,
                    right: 10,
                    zIndex: 1000,
                    background: 'rgba(24,28,36,0.82)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    minWidth: 180,
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.45)'
                }}
            >
                <div
                    className="sv-vertical-exaggeration-label"
                    data-testid="vertical-exaggeration-label"
                    style={{
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: 11,
                        fontFamily: 'Montserrat, sans-serif',
                        marginBottom: 6,
                        letterSpacing: '0.02em'
                    }}
                >
                    Vertical ×{current.toFixed(1)}
                </div>
                <div
                    className="mapstore-slider sv-dataset-transparency sv-with-tooltip"
                    data-testid="vertical-exaggeration-slider"
                    style={{ width: 150 }}
                >
                    <Slider
                        start={current}
                        step={VERT_EXAG_STEP}
                        range={{ min: VERT_EXAG_MIN, max: VERT_EXAG_MAX }}
                        onChange={this.handleChange}
                        tooltips={[{ to: (v) => `${parseFloat(v).toFixed(1)}×` }]}
                    />
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const map = mapSelector(state);
    return {
        visible: isCesium(state),
        verticalExaggeration: map?.mapOptions?.verticalExaggeration ?? VERT_EXAG_DEFAULT
    };
};

const mapDispatchToProps = (dispatch) => ({
    onChangeExaggeration: (value) => dispatch(updateMapOptions({ verticalExaggeration: value }))
});

export const VerticalExaggerationSlider = connect(
    mapStateToProps,
    mapDispatchToProps
)(VerticalExaggerationSliderClass);

export default VerticalExaggerationSlider;
