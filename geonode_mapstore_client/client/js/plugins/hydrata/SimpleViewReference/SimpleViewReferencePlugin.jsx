/**
 * SimpleViewReference — dev-only plugin. Renders the v1 primitive catalogue
 * inside a .simple-view-panel shell, accessible via a "Ref" button in the
 * left toolbar area.
 *
 * TASK-1662 (W2 epic/1659-simpleview-design-system)
 *
 * ─────────────────────────────────────────────────────────────────
 * HOW TO OPEN ON :8081 (for the construction proof):
 *
 *   1. Open any map in map_viewer, e.g.: http://localhost:8081/maps/1335/map_viewer
 *   2. A "Ref" button appears at bottom-left (z-index 1030, below left toolbar).
 *   3. Click "Ref" → the primitive catalogue appears in a .simple-view-panel shell
 *      on the left side of the map.
 *   4. The panel is scrollable; all v1 primitives + variants are catalogued there.
 *
 * REGISTRATION: Only in the dev localConfig (gitignored working copy at
 *   /opt/geonode-mapstore-client/geonode_mapstore_client/static/mapstore/configs/localConfig.json).
 *   The plugin is exported from plugins/index.js behind a DEV guard so it is
 *   tree-shaken out of prod builds. Never add to any per-site deploy file.
 * ─────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import SimpleViewReferencePanel from '../SimpleView/components/SimpleViewReferencePanel';

const PANEL_STYLE = {
    position: 'absolute',
    top: 65,
    left: 105,
    width: 400,
    maxHeight: 'calc(100vh - 80px)',
    overflowY: 'auto',
    zIndex: 1030,
    display: 'flex',
    flexDirection: 'column'
};

const BUTTON_STYLE = {
    position: 'absolute',
    bottom: 50,
    left: 20,
    zIndex: 1031,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    background: 'rgba(255, 230, 0, 0.85)',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: 4,
    cursor: 'pointer',
    letterSpacing: '0.05em'
};

class SimpleViewReferenceContainer extends React.Component {
    constructor(props) {
        super(props);
        this.state = { open: false };
    }

    render() {
        const { open } = this.state;
        return (
            <>
                <button
                    style={BUTTON_STYLE}
                    title="Open SimpleView primitive catalogue (dev-only)"
                    onClick={() => this.setState({ open: !open })}
                >
                    {open ? '✕ Ref' : '☰ Ref'}
                </button>
                {open && (
                    <div className="simple-view-panel" style={PANEL_STYLE}>
                        <SimpleViewReferencePanel />
                    </div>
                )}
            </>
        );
    }
}

export default createPlugin('SimpleViewReference', {
    component: SimpleViewReferenceContainer
});
