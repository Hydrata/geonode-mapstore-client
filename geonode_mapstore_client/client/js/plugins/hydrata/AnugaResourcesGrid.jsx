
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
import { loadFeaturedResources } from '@js/actions/gnsearch';
import AnugaProjectList from '@js/plugins/hydrata/Anuga/components/AnugaProjectList';
import { hashLocationToHref } from '@js/utils/SearchUtils';
import { getFeaturedResults } from '@js/selectors/search';
import { featuredResourceDownload } from '@js/selectors/resourceservice';
import gnsearch from '@js/reducers/gnsearch';
import gnresource from '@js/reducers/gnresource';
import resourceservice from '@js/reducers/resourceservice';

import gnsearchEpics from '@js/epics/gnsearch';
import gnsaveEpics from '@js/epics/gnsave';
import resourceServiceEpics from '@js/epics/resourceservice';

const ConnectedAnugaResourcesGrid = connect(
    createSelector([
        state => state?.gnsearch?.resources?.filter(resource => ['map', 'geostory'].includes(resource.resource_type))
    ], (resources) => ({
        resources
    })
    ), {
        loadFeaturedResources
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
    fetchFeaturedResources,
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
                        onLoad={fetchFeaturedResources}
                        containerStyle={{
                            minHeight: 'auto'
                        }}/>

                </div>
            </div>
        </Portal>
    );
}

const AnugaResourcesGridPlugin = connect(
    createSelector([
        state => state?.router?.location,
        state => state?.gnresource?.data || null
    ], (location, resource) => ({
        location,
        resource
    })),
    { fetchFeaturedResources: loadFeaturedResources }
)(AnugaResourcesGrid);

export default createPlugin('AnugaResourcesGrid', {
    component: AnugaResourcesGridPlugin,
    containers: {},
    epics: {
        ...gnsearchEpics,
        ...gnsaveEpics,
        ...resourceServiceEpics
    },
    reducers: {
        gnsearch,
        gnresource,
        resourceservice
    }
});
