/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { createPlugin } from '@mapstore/framework/utils/PluginsUtils';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import DetailsPanel from '@js/components/home/DetailsPanel';
import {
    editTitleResource,
    editAbstractResource,
    editThumbnailResource
} from '@js/actions/gnresource';

import gnresource from '@js/reducers/gnresource';


const ConnectedDetailsPanel = connect(
    createSelector([
        state => state?.gnresource?.data || null,
        state => state?.gnresource?.loading || false
    ], (resource, loading, editMode) => ({
        resource,
        loading,
        editMode
    }))
)(DetailsPanel);


function DetailViewer({
    onEditResource,
    onEditAbstractResource,
    onEditThumbnail}) {

    const handleTitleValue = (val) => {
        onEditResource(val);
    };

    const handleAbstractValue = (val) => {
        onEditAbstractResource(val);
    };
    const handleEditThumbnail = (val) => {
        onEditThumbnail(val);
    };

    return (
        <div
            style={{
                top: 0,
                left: 0,
                width: '100%',
                height: '100%'

            }}>
            <ConnectedDetailsPanel
                editTitle={handleTitleValue}
                editAbstract={handleAbstractValue}
                editThumbnail={handleEditThumbnail}
                activeEditMode
                sectionStyle={{
                    width: '600px',
                    position: 'fixed'
                }}
            />
        </div>
    );
}

const DetailViewerPlugin = connect(
    createSelector([
    ], () => ({})),
    {
        onEditResource: editTitleResource,
        onEditAbstractResource: editAbstractResource,
        onEditThumbnail: editThumbnailResource
    }
)(DetailViewer);


export default createPlugin('DetailViewer', {
    component: DetailViewerPlugin,
    containers: {
        ViewerLayout: {
            name: 'DetailViewer',
            target: 'rightColumn',
            priority: 1
        }
    },
    epics: {},
    reducers: {
        gnresource
    }
});
