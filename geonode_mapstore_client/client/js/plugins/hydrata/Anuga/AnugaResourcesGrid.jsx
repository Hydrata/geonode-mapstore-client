
/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

import React from 'react';
import { connect } from 'react-redux';
import { createPortal } from 'react-dom';
import { createPlugin } from '@mapstore/framework/utils/PluginsUtils';
import url from 'url';
import { createSelector } from 'reselect';
import { buildHrefByTemplate } from '@js/utils/MenuUtils';
import AnugaProjectList from '@js/plugins/hydrata/Anuga/components/AnugaProjectList';
import { hashLocationToHref } from '@js/utils/SearchUtils';
import gnsearch from '@js/reducers/gnsearch';
import gnresource from '@js/reducers/gnresource';
import resourceservice from '@js/reducers/resourceservice';
import { updateAnugaResources } from './actionsAnuga';
import anuga from './reducersAnuga';
import { getAnugaResourcesEpic } from './epicsAnuga';

import gnsearchEpics from '@js/epics/gnsearch';
import gnsaveEpics from '@js/epics/gnsave';
import resourceServiceEpics from '@js/epics/resourceservice';

const ConnectedAnugaResourcesGrid = connect(
    createSelector([
        state => {
            return state?.anuga?.anugaHomePageResources?.maps;
        }
    ], (resources) => ({
        resources
    })
    ), {
        updateAnugaResources
    }
)(AnugaProjectList);

function Portal({ targetSelector = '', children }) {
    const parent = targetSelector ? document.querySelector(targetSelector) : null;
    if (parent) {
        return createPortal(children, parent);
    }
    return <>{children}</>;
}

function AnugaResourcesGrid({
    location,
    pagePath = '',
    updateAnugaResourcesLocal,
    targetSelector,
    resource
}) {
    function handleFormatHref(options) {
        return pagePath + hashLocationToHref({
            location,
            ...options
        });
    }

    const { query } = url.parse(location.search, true);
    return (
        <Portal targetSelector={targetSelector}>
            <div className="gn-row gn-home-section">
                <div id={"anuga-resources-grid"}  className="gn-grid-container">
                    <ConnectedAnugaResourcesGrid
                        query={query}
                        getDetailHref={res => handleFormatHref({
                            query: {
                                'd': `${res.pk};${res.resource_type}`
                            },
                            replaceQuery: true,
                            excludeQueryKeys: []
                        })}
                        formatHref={handleFormatHref}
                        cardOptions={[]}
                        isCardActive={res => res.pk === resource?.pk}
                        buildHrefByTemplate={buildHrefByTemplate}
                        onLoad={updateAnugaResourcesLocal}
                        containerStyle={{
                            minHeight: 'auto'
                        }}/>

                </div>
            </div>
        </Portal>
    );
}

const mapDispatchToProps = (dispatch) => {
    return {
        updateAnugaResourcesLocal: (action, pageSize) => dispatch(updateAnugaResources(action, pageSize))
    };
};

const AnugaResourcesGridPlugin = connect(
    createSelector([
        state => state?.router?.location,
        state => state?.anuga?.data || null
    ], (location, resource) => ({
        location,
        resource
    })),
    mapDispatchToProps
)(AnugaResourcesGrid);

export default createPlugin('AnugaResourcesGrid', {
    component: AnugaResourcesGridPlugin,
    containers: {},
    epics: {
        ...gnsearchEpics,
        ...gnsaveEpics,
        ...resourceServiceEpics,
        getAnugaResourcesEpic
    },
    reducers: {
        gnsearch,
        gnresource,
        resourceservice,
        anuga
    }
});
