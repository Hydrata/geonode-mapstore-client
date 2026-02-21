import React from 'react';
import Message from '@mapstore/framework/components/I18N/Message';

const HGevalProgressIndicator = ({ progress }) => {
    const { completed, total } = progress;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="hgeval-progress">
            <h4><Message msgId="hydrata.hgeval.generatingReport" /></h4>
            <div className="progress">
                <div
                    className="progress-bar progress-bar-striped active"
                    role="progressbar"
                    style={{ width: `${percent}%` }}
                >
                    {completed} of {total} queries
                </div>
            </div>
            <p className="text-muted">
                <Message msgId="hydrata.hgeval.queryingLayers" />
            </p>
        </div>
    );
};

export default HGevalProgressIndicator;
