/*
* Copyright 2020, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

import React from 'react';
import Message from '@mapstore/framework/components/I18N/Message';
import { Glyphicon, Button } from 'react-bootstrap';

const iconMap = {
    'gnviewer.accessDenied': 'lock',
    'gnviewer.loginRequired': 'log-in',
    'gnviewer.resourceNotFound': 'question-sign',
    // TASK-1294: chunk-load failure shown as warning, not hard lock.
    'gnviewer.pluginLoadError': 'refresh'
};

function MainEventView({
    msgId,
    icon
}) {
    const resolvedIcon = iconMap[msgId] || icon;
    const isLoginRequired = msgId === 'gnviewer.loginRequired';
    // TASK-1294: offer a reload button for chunk-load failures instead of
    // leaving the user on a blank screen with only "Return Home".
    const isPluginLoadError = msgId === 'gnviewer.pluginLoadError';
    return (
        <div className="gn-main-event-container">
            <div className="gn-main-event-content">
                <div className="gn-main-event-text">
                    <div className="gn-main-icon">
                        <Glyphicon glyph={resolvedIcon} />
                    </div>
                    {msgId && <Message msgId={msgId} />}
                    <div className="gn-main-event-actions" style={{ marginTop: '1.5rem' }}>
                        {isLoginRequired && (
                            <Button bsStyle="primary" href="/account/login/">
                                <Message msgId="gnviewer.signIn" />
                            </Button>
                        )}
                        {isPluginLoadError && (
                            <Button bsStyle="primary" onClick={() => window.location.reload()}>
                                <Message msgId="gnviewer.reload" />
                            </Button>
                        )}
                        <Button href="/" style={{ marginLeft: (isLoginRequired || isPluginLoadError) ? '0.5rem' : 0 }}>
                            <Message msgId="gnviewer.returnHome" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

MainEventView.defaultProps = {
    msgId: '',
    icon: 'exclamation-sign'
};

export default MainEventView;
