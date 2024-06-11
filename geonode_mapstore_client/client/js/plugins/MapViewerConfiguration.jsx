
/*
 * Copyright 2024, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

import React from 'react';
import { connect } from 'react-redux';
import isEmpty from 'lodash/isEmpty';
import { createSelector } from 'reselect';

import Button from '@js/components/Button';
import { createPlugin } from '@mapstore/framework/utils/PluginsUtils';
import { manageLinkedResource, processResources } from '@js/actions/gnresource';
import Message from '@mapstore/framework/components/I18N/Message';
import Loader from '@mapstore/framework/components/misc/Loader';
import { ResourceTypes } from '@js/utils/ResourceUtils';
import ResizableModal from '@mapstore/framework/components/misc/ResizableModal';
import Portal from '@mapstore/framework/components/misc/Portal';
import ResourceCard from '@js/components/ResourceCard/ResourceCard';
import { ProcessTypes } from '@js/utils/ResourceServiceUtils';
import { setControlProperty } from '@mapstore/framework/actions/controls';
import FaIcon from '@js/components/FaIcon/FaIcon';
import { getResourceData } from '@js/selectors/resource';

const WarningLinkedResource = ({resourceType} = {}) => {
    if (resourceType) {
        return (
            <div className="gn-resource-delete-warning">
                <FaIcon className="warning" name="warning"/> &nbsp;
                <Message msgId={`gnviewer.linkedResource.deleteAndUnlinkWarning.${resourceType}`}/>
            </div>
        );
    }
    return null;
};

function MapViewerConfigurationPlugin({
    enabled,
    resources = [],
    onClose = () => {},
    onDelete = () => {},
    onRemove = () => {},
    loading,
    resourceType,
    source
}) {
    const removeLinkedResource = () => {
        const target = resources.map(res => res?.pk);
        if (!isEmpty(source) && !isEmpty(target) && resourceType) {
            onRemove({
                resourceType,
                source,
                target,
                processType: ProcessTypes.REMOVE_LINKED_RESOURCE
            });
        }
    };

    const onClosePanel = () => {
        removeLinkedResource();
        onClose();
    };

    const onRemoveLinkedResource = () => {
        removeLinkedResource();
        onDelete(resources);
    };

    return (
        <Portal>
            <ResizableModal
                title={<Message msgId="gnviewer.linkedResource.deleteTitle" msgParams={{ count: resources.length }}/>}
                show={enabled}
                fitContent
                clickOutEnabled={false}
                modalClassName="gn-simple-dialog"
                buttons={loading
                    ? []
                    : [{
                        text: <Message msgId="gnviewer.deleteResourceNo" msgParams={{ count: resources.length }} />,
                        onClick: onClosePanel
                    },
                    {
                        text: <Message msgId="gnviewer.deleteResourceYes" msgParams={{ count: resources.length }} />,
                        bsStyle: 'danger',
                        onClick: onRemoveLinkedResource
                    }]
                }
                onClose={loading ? null : () => onClose()}
            >
                <ul
                    className="gn-card-grid"
                    style={{
                        listStyleType: 'none',
                        padding: '0.5rem',
                        margin: 0
                    }}
                >
                    {resources.map((data, idx) => {
                        return (
                            <li style={{ padding: '0.25rem 0' }} key={data.pk + '-' + idx}>
                                <ResourceCard data={data} layoutCardsStyle="list" readOnly/>
                            </li>
                        );
                    })}
                </ul>
                <WarningLinkedResource resourceType={resourceType}/>
                {loading && <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Loader size={70}/>
                </div>}
            </ResizableModal>
        </Portal>
    );
}

const ConnectedRemoveLinkedResource = connect(
    createSelector([
        state => state?.controls?.[ProcessTypes.REMOVE_LINKED_RESOURCE]?.value,
        state => state?.controls?.[ProcessTypes.REMOVE_LINKED_RESOURCE]?.loading,
        getResourceData
    ], (value, loading, selectedResource) => ({
        resources: value?.resources ?? [],
        resourceType: value?.resourceType,
        enabled: !isEmpty(value?.resources),
        loading,
        source: selectedResource?.pk
    })),
    {
        onRemove: manageLinkedResource,
        onDelete: processResources.bind(null, ProcessTypes.REMOVE_LINKED_RESOURCE),
        onClose: setControlProperty.bind(null, ProcessTypes.REMOVE_LINKED_RESOURCE, 'value', undefined)
    }
)(MapViewerConfigurationPlugin);

const ButtonLinkedResource = ({  hide, loading, labelId, showLoader, ...props}) => {
    return !hide ? (
        <Button
            {...props}
            disabled={loading}
            style={{display: "flex", alignItems: "center", gap: 10}}
        >
            <Message msgId={labelId ?? 'gnviewer.linkedResource.remove'}/>
            {loading && showLoader && <Loader size={12}/>}
        </Button>
    ) : null;
};

const RemoveMapViewerButton = (props) => {
    const resourceType = ResourceTypes.VIEWER;
    const { linkedResources, ...mapViewerResource } = props.viewerLinkedResource ?? {};

    // when map viewer has one association
    const allowDelete = linkedResources?.linkedBy?.length === 1;

    const handleOnClick = () => {
        if (allowDelete) {
            props.onDelete({resources: [mapViewerResource], resourceType});
        } else {
            const sourcePk = props.resource?.pk;
            const targetPk = mapViewerResource?.pk;
            if (!isEmpty(sourcePk) && !isEmpty(targetPk) && resourceType) {
                props.onRemove({
                    resourceType,
                    source: sourcePk,
                    target: targetPk,
                    processType: ProcessTypes.REMOVE_LINKED_RESOURCE
                });
            }
        }
    };
    return (
        <ButtonLinkedResource
            {...props}
            showLoader={!allowDelete}
            onClick={handleOnClick}
            labelId={'gnviewer.removeViewerConfiguration'}
        />
    );
};

const RemoveMapViewerConfiguration = connect(
    (state) => ({
        loading: state?.controls?.[ProcessTypes.REMOVE_LINKED_RESOURCE]?.loading,
        viewerLinkedResource: state?.gnresource?.viewerLinkedResource,
        resource: state?.gnresource?.data
    }),
    {
        onRemove: manageLinkedResource,
        onDelete: setControlProperty.bind(null, ProcessTypes.REMOVE_LINKED_RESOURCE, 'value')
    }
)(RemoveMapViewerButton);

const EditMapViewer = (props) => {
    return (
        <ButtonLinkedResource
            {...props}
            href={'#/viewer/' + props.resourceParams?.appPk + '/map/' + props.resource?.pk}
            labelId={'gnviewer.editViewerConfiguration'}
        />
    );
};
const EditMapViewerConfiguration = connect(
    (state) => ({
        loading: state?.controls?.[ProcessTypes.REMOVE_LINKED_RESOURCE]?.loading,
        resourceParams: state?.gnresource?.params,
        resource: state?.gnresource?.data
    }),
    {}
)(EditMapViewer);

export default createPlugin('MapViewerConfiguration', {
    component: ConnectedRemoveLinkedResource,
    containers: {
        ActionNavbar: [{
            name: 'RemoveMapViewer',
            Component: RemoveMapViewerConfiguration
        },
        {
            name: 'EditMapViewer',
            Component: EditMapViewerConfiguration
        }]
    },
    epics: {},
    reducers: {}
});
