/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Button from '@js/components/Button';
import Message from '@mapstore/framework/components/I18N/Message';
import FaIcon from '@js/components/FaIcon';
import isEqual from 'lodash/isEqual';
import FilterItems from './FilterItems';
import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';
import { updateFilterFormItemsWithFacet, filterFormItemsContainFacet } from '@js/utils/SearchUtils';
import { Glyphicon } from 'react-bootstrap';


/**
 * FilterForm component allows to configure a list of field that can be used to apply filter on the page
 * @name FiltersForm
 * @memberof components
 * @prop {string} id the thumbnail is scaled based on the following configuration
 */
function FiltersForm({
    id,
    style,
    styleContainerForm,
    query,
    fields: fieldsProp,
    facets,
    onChange,
    onClose,
    onClear,
    extentProps,
    timeDebounce,
    onGetFacets,
    filters,
    setFilters
}) {

    const [fields, setFields] = useState([]);
    const [prevFieldsProp, setPrevFieldsProp] = useState();
    const [prevFacets, setPrevFacets] = useState();
    if (!isEqual(fieldsProp, prevFieldsProp) || !isEqual(facets, prevFacets)) {
        setPrevFieldsProp(fieldsProp);
        setPrevFacets(facets);
        setFields(updateFilterFormItemsWithFacet({formItems: fieldsProp, facetItems: facets}));
    }

    useEffect(() => {
        if (fieldsProp && onGetFacets && filterFormItemsContainFacet(fieldsProp) && isEmpty(facets)) {
            onGetFacets(query);
        }
    }, [facets]);

    const handleFieldChange = (newParam) => {
        onChange(newParam);
    };

    return (
        <div className="gn-filter-form" style={styleContainerForm} >
            <div className="gn-filter-form-header">
                <div className="gn-filter-form-title">
                    <div><FaIcon name="filter" /> <strong><Message msgId="gnhome.filters" /></strong></div>
                    <Button
                        size="sm"
                        variant="default"
                        onClick={onClear}
                        disabled={isEmpty(omit(query, ['d', 'page', 'sort']))}
                    >
                        <Message msgId="gnhome.clearFilters"/>
                    </Button>
                </div>
                <Button
                    variant="default"
                    onClick={() => onClose()}
                    className="square-button-md"
                >
                    <Glyphicon glyph="1-close"/>
                </Button>
            </div>
            <div
                className="gn-filter-form-body"
            >
                <div className="gn-filter-form-content">
                    <form
                        style={style}
                    >
                        <FilterItems
                            id={id}
                            items={fields}
                            values={query}
                            extentProps={{ ...extentProps, timeDebounce }}
                            onChange={handleFieldChange}
                            filters={filters}
                            setFilters={setFilters}
                        />
                    </form>
                </div>
            </div>
        </div>
    );
}

FiltersForm.defaultProps = {
    id: PropTypes.string,
    style: PropTypes.object,
    styleContainerForm: PropTypes.object,
    query: PropTypes.object,
    fields: PropTypes.array,
    onChange: PropTypes.func,
    onClose: PropTypes.func,
    onClear: PropTypes.func,
    extentProps: PropTypes.object,
    submitOnChangeField: PropTypes.bool,
    timeDebounce: PropTypes.number,
    formParams: PropTypes.object

};

FiltersForm.defaultProps = {
    query: {},
    fields: [],
    onChange: () => {},
    onClose: () => {},
    onClear: () => {},
    submitOnChangeField: true,
    timeDebounce: 500,
    formParams: {}
};

const arePropsEqual = (prevProps, nextProps) => {
    return isEqual(prevProps.query, nextProps.query)
        && isEqual(prevProps.fields, nextProps.fields)
        && isEqual(prevProps.facets, nextProps.facets)
        && isEqual(prevProps.filters, nextProps.filters);
};


export default memo(FiltersForm, arePropsEqual);
