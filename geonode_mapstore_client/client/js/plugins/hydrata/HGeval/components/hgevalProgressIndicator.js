import React from 'react';
import Message from '@mapstore/framework/components/I18N/Message';
import { ProgressBar } from '../../SimpleView/components/primitives';

const HGevalProgressIndicator = ({ progress }) => {
    const { completed, total } = progress;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="sv-hgeval-progress" style={{ textAlign: 'center', padding: '20px 10px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--sv-text, rgba(255, 255, 255, 0.85))' }}>
                <Message msgId="hydrata.hgeval.generatingReport" />
            </h4>
            <ProgressBar pct={percent} />
            <p style={{ fontSize: '12px', marginTop: '6px', color: 'var(--sv-text-dim, rgba(255, 255, 255, 0.68))' }}>
                {completed} of {total} queries
            </p>
            <p style={{ fontSize: '12px', color: 'var(--sv-text-dim, rgba(255, 255, 255, 0.68))' }}>
                <Message msgId="hydrata.hgeval.queryingLayers" />
            </p>
        </div>
    );
};

export default HGevalProgressIndicator;
