/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import Button from '@js/components/Button';
import Spinner from '@js/components/Spinner';
import HTML from '@mapstore/framework/components/I18N/HTML';
import FaIcon from '@js/components/FaIcon';
import { withResizeDetector } from 'react-resize-detector';
import Cards from './Cards';

const AnugaProjectList = withResizeDetector(({
    resources,
    loading,
    isNextPageAvailable,
    formatHref,
    isCardActive,
    containerStyle,
    header,
    buildHrefByTemplate,
    isPreviousPageAvailable,
    loadFeaturedResources,
    onLoad,
    width,
    downloading,
    getDetailHref
}) => {

    const [count, setCount] = useState();

    const nextIconStyles = {
        fontSize: '1rem',
        ...(!isNextPageAvailable || loading ? {color: 'grey', cursor: 'not-allowed'} : {cursor: 'pointer'})
    };

    const previousIconStyles = {
        fontSize: '1rem',
        ...(!isPreviousPageAvailable || loading ? { color: 'grey', cursor: 'not-allowed' } : { cursor: 'pointer' })
    };

    return (
        <div className="gn-card-grid">
            {header}
            <div style={{
                display: 'flex', width: '100%'
            }}>
                <div style={{ flex: 1, width: '100%' }}>
                    <div className="gn-card-grid-container" style={containerStyle}>
                        <h3><HTML msgId={`Your Projects:`}/></h3>
                        <div>
                            { loading &&
                                <div style={{"height": "270px", "paddingTop": "130px"}}>
                                    <Spinner size="lg"  animation="border" role="status">
                                        <span className="sr-only">Loading...</span>
                                    </Spinner>
                                </div>
                            }
                        </div>
                        <Cards
                            featured
                            resources={resources}
                            formatHref={formatHref}
                            isCardActive={isCardActive}
                            buildHrefByTemplate={buildHrefByTemplate}
                            containerWidth={width}
                            onResize={(cardsCount) => {
                                !isNaN(cardsCount) && onLoad(undefined, cardsCount);
                                setCount(cardsCount);
                            }}
                            downloading={downloading}
                            getDetailHref={getDetailHref}
                        />
                        <div className="gn-card-grid-pagination featured-list">

                            <Button size="sm" onClick={() => loadFeaturedResources("previous", count)} disabled={!isPreviousPageAvailable || loading}
                                aria-hidden="true">
                                <FaIcon  style={previousIconStyles} name="caret-left"/>
                            </Button>

                            <div>
                            </div>
                            <Button size="sm" onClick={() => loadFeaturedResources("next", count)} disabled={!isNextPageAvailable || loading}
                                aria-hidden="true">
                                <FaIcon style={nextIconStyles} name="caret-right"/>

                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

AnugaProjectList.defaultProps = {
    page: 1,
    resources: [],
    isNextPageAvailable: false,
    loading: false,
    formatHref: () => '#',
    isCardActive: () => false,
    isPreviousPageAvailable: false,
    onLoad: () => { }
};

export default AnugaProjectList;
