import React from 'react';

const HGevalProgressIndicator = ({ progress }) => {
    const { completed, total } = progress;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="hgeval-progress">
            <h4>Generating Report...</h4>
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
                Querying GeoServer layers and raster data at your selected location...
            </p>
        </div>
    );
};

export default HGevalProgressIndicator;
