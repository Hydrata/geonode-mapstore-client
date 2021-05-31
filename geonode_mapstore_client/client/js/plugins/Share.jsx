/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import { createPlugin } from '@mapstore/framework/utils/PluginsUtils';
import {toggleControl} from '@mapstore/framework/actions/controls';
import Message from '@mapstore/framework/components/I18N/Message';
import { Glyphicon } from 'react-bootstrap';
import controls from '@mapstore/framework/reducers/controls';
import ShareEmbed from '@mapstore/framework/components/share/ShareEmbed';
import ShareLink from '@mapstore/framework/components/share/ShareLink';
import ResizableModal from '@mapstore/framework/components/misc/ResizableModal';
import { mapInfoSelector } from '@mapstore/framework/selectors/map';
import url from 'url';

function getShareUrl({
    resourceId,
    pathTemplate
}) {
    const {
        host,
        protocol
    } = url.parse(location.href);
    const pathname = pathTemplate.replace(/\{id\}/g, resourceId);
    return url.format({
        host,
        protocol,
        pathname
    });
}

function Share({
    resourceId,
    pathTemplate,
    enabled,
    onClose
}) {
    const shareUrl = getShareUrl({
        resourceId,
        pathTemplate
    });
    return (
        <ResizableModal
            modalClassName="gn-share-modal"
            title={<Message msgId="share.title"/>}
            show={enabled}
            fitContent
            clickOutEnabled={false}
            onClose={() => onClose()}
        >
            <ShareLink
                shareUrl={shareUrl}
            />
            <ShareEmbed
                showTOCToggle={false}
                shareUrl={shareUrl}
            />
        </ResizableModal>
    );
}

Share.propTypes = {
    resourceId: PropTypes.oneOfType([ PropTypes.number, PropTypes.string ]),
    pathTemplate: PropTypes.string,
    enabled: PropTypes.bool,
    onClose: PropTypes.func
};

Share.defaultProps = {
    resourceId: null,
    pathTemplate: '/apps/{id}/embed',
    enabled: false,
    onClose: () => {}
};

const SharePlugin = connect(
    createSelector([
        state => state?.controls?.share?.enabled,
        state => state?.gnresource?.id,
        mapInfoSelector
    ], (enabled, resourceId, mapInfo) => ({
        enabled,
        resourceId: resourceId || mapInfo?.id
    })),
    {
        onClose: toggleControl.bind(null, 'share', null)
    }
)(Share);

export default createPlugin('Share', {
    component: SharePlugin,
    containers: {
        BurgerMenu: {
            name: 'share',
            position: 1000,
            text: <Message msgId="share.title"/>,
            icon: <Glyphicon glyph="share-alt"/>,
            action: toggleControl.bind(null, 'share', null),
            selector: createSelector(
                state => state?.gnresource?.isNew,
                state => state?.gnresource?.id,
                mapInfoSelector,
                (isNew, resourceId, mapInfo) => ({
                    style: !isNew && (resourceId || mapInfo?.id) ? { } : { display: 'none' }
                })
            )
        }
    },
    epics: {},
    reducers: {
        controls
    }
});
