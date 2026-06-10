/**
 * TASK-1599 (W1) — TerrainWorkbench panel component.
 *
 * Three sections:
 *   terrain     — live (filled by TASK-1600 recipe UI)
 *   delineation — stubbed (arrives in Epic B)
 *   catchments  — stubbed (arrives in Epic C)
 *
 * Permission-gated: only renders for project members (isAnugaProject guard,
 * same as Anuga / Hydrology containers).
 */
import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { setTerrainWorkbenchSection, setTerrainWorkbenchVisible } from '../actionsTerrainWorkbench';
import { getProjectId } from '@js/plugins/hydrata/Anuga/selectorsAnuga';
import '../terrainWorkbench.css';
import '../../SimpleView/simpleView.css';

const SECTIONS = [
    { key: 'terrain', label: 'Terrain', live: true },
    { key: 'delineation', label: 'Delineation', live: false, epicNote: 'Epic B' },
    { key: 'catchments', label: 'Catchments', live: false, epicNote: 'Epic C' },
];

/**
 * Stub section shown for features not yet built.
 */
function StubSection({ label, epicNote }) {
    return (
        <div className="terrain-workbench-stub">
            <div className="terrain-workbench-stub-title">{label}</div>
            <p>
                {label} tools arrive in <strong>{epicNote}</strong>. <br />
                They will appear here automatically when the workbench is extended.
            </p>
        </div>
    );
}

StubSection.propTypes = {
    label: PropTypes.string.isRequired,
    epicNote: PropTypes.string.isRequired,
};

/**
 * Live Terrain section — recipe UI placeholder (filled by TASK-1600).
 */
function TerrainSection() {
    return (
        <div className="terrain-workbench-body" data-testid="terrain-section">
            {/* TASK-1600 will mount the AnalysisSurface recipe UI here. */}
            <p style={{ color: '#888', fontSize: 13 }}>
                Analysis Surface recipe UI loading&hellip;
            </p>
        </div>
    );
}

/**
 * TerrainWorkbenchPanel — main workbench panel.
 */
export class TerrainWorkbenchPanel extends React.Component {
    static propTypes = {
        isAnugaProject: PropTypes.bool,
        activeSection: PropTypes.string,
        onSetSection: PropTypes.func,
    };

    static defaultProps = {
        isAnugaProject: false,
        activeSection: 'terrain',
        onSetSection: () => {},
    };

    _renderSection(key) {
        switch (key) {
        case 'terrain':
            return <TerrainSection key="terrain" />;
        case 'delineation':
            return <StubSection key="delineation" label="Delineation" epicNote="Epic B" />;
        case 'catchments':
            return <StubSection key="catchments" label="Catchments" epicNote="Epic C" />;
        default:
            return null;
        }
    }

    render() {
        const { isAnugaProject, activeSection, onSetSection } = this.props;
        if (!isAnugaProject) {
            return null;
        }
        return (
            <div className="terrain-workbench-panel" data-testid="terrain-workbench-panel">
                <nav className="terrain-workbench-nav" role="navigation" aria-label="Terrain Workbench sections">
                    {SECTIONS.map(({ key, label }) => (
                        <button
                            key={key}
                            className={`terrain-workbench-nav-btn${activeSection === key ? ' active' : ''}`}
                            onClick={() => onSetSection(key)}
                            aria-pressed={activeSection === key}
                            data-testid={`section-btn-${key}`}
                        >
                            {label}
                        </button>
                    ))}
                </nav>
                {this._renderSection(activeSection)}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    isAnugaProject: !!getProjectId(state),
    activeSection: state?.terrainWorkbench?.activeSection || 'terrain',
});

const mapDispatchToProps = (dispatch) => ({
    onSetSection: (section) => dispatch(setTerrainWorkbenchSection(section)),
    onSetVisible: (visible) => dispatch(setTerrainWorkbenchVisible(visible)),
});

export default connect(mapStateToProps, mapDispatchToProps)(TerrainWorkbenchPanel);
