/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import castArray from 'lodash/castArray';
import isNil from 'lodash/isNil';
import debounce from 'lodash/debounce';
import PropTypes from 'prop-types';
import { FormGroup, Checkbox, FormControl as FormControlRB } from 'react-bootstrap';
import ReactSelect from 'react-select';

import Accordion from "@js/components/Accordion";
import Tabs from "@js/components/Tabs";
import SelectInfiniteScroll from '@js/components/SelectInfiniteScroll';
import localizedProps from '@mapstore/framework/components/misc/enhancers/localizedProps';
import withDebounceOnCallback from '@mapstore/framework/components/misc/enhancers/withDebounceOnCallback';
import { getMessageById } from '@mapstore/framework/utils/LocaleUtils';
import FilterByExtent from './FilterByExtent';
import DateRangeFilter from './DateRangeFilter';
import FaIcon from '../FaIcon';
import Group from '@js/components/Group/Group';

const FormControl = localizedProps('placeholder')(FormControlRB);
function InputControl({ onChange, value, debounceTime, ...props }) {
    return <FormControl {...props} value={value} onChange={event => onChange(event.target.value)}/>;
}
const InputControlWithDebounce = withDebounceOnCallback('onChange', 'value')(InputControl);

const SelectSync = localizedProps('placeholder')(ReactSelect);

function Label({item} = {}, { messages }) {
    return (
        <div className="gn-label">
            <span className="prefix">
                {item.icon ? <FaIcon name={item.icon}/> : item.image ? <img src={item.image}/> : null}
                {item.labelId ? getMessageById(messages, item.labelId) : <span>{item.label}</span>}
            </span>
            {!isNil(item.count) && <span className="facet-count">{`(${item.count})`}</span>}
        </div>
    );
}
Label.contextTypes = {
    messages: PropTypes.object
};

function Facet({
    item,
    active,
    onChange
}) {
    const filterValue = item.filterValue || item.id;
    return (
        <div className={`facet${active ? " active" : ""}`} onClick={onChange}>
            <input
                type="checkbox"
                id={filterValue}
                name={filterValue}
                checked={!!active}
                onKeyDown={(event) => event.key === 'Enter' ? onChange() : null}
                style={{ display: 'block', width: 0, height: 0, overflow: 'hidden', opacity: 0, padding: 0, margin: 0 }}
            />
            <Label item={item}/>
        </div>
    );
}

function ExtentFilterWithDebounce({
    id,
    labelId,
    query,
    timeDebounce,
    layers,
    vectorLayerStyle,
    onChange
}) {
    const extentChange = debounce((extent) => {
        onChange({ extent });
    }, timeDebounce);
    return (
        <FilterByExtent
            id={id}
            labelId={labelId}
            extent={query.extent}
            layers={layers}
            vectorLayerStyle={vectorLayerStyle}
            onChange={(({ extent }) =>{
                extentChange(extent);
            })}
        />
    );
}
function FilterItem({
    id,
    values,
    onChange,
    extentProps,
    timeDebounce,
    field,
    filters,
    setFilters
}, { messages }) {


    if (field.type === 'search') {
        return (
            <InputControlWithDebounce
                placeholder="gnhome.search"
                value={values.q || ''}
                debounceTime={300}
                onChange={(q) => onChange({ q })}
            />
        );
    }
    if (field.type === 'extent') {
        return (
            <ExtentFilterWithDebounce
                labelId={field.labelId}
                id={field.uuid}
                query={values}
                timeDebounce={timeDebounce}
                layers={field?.layers || extentProps?.layers}
                vectorLayerStyle={field?.vectorStyle || extentProps?.style}
                onChange={onChange}
            />
        );
    }
    if (field.type === 'date-range') {
        return (
            <DateRangeFilter
                query={values}
                labelId={field.labelId}
                filterKey={field.filterKey}
                onChange={onChange}
            />
        );
    }
    if (field.type === 'select' && field.loadItems) {
        const filterKey = field.key;
        const isFacet = field.style === 'facet';
        const getFilterById = (value) => {
            const filterValue = filters?.[filterKey + value];
            if (isFacet && filterValue?.facetName) {
                return field.name === filterValue.facetName ? filterValue : null;
            }
            return filterValue;
        };
        const filterValues = castArray(values[filterKey] || []);
        const currentValues = filterValues.filter(v => getFilterById(v));
        const otherValues = filterValues.filter(v => !getFilterById(v));
        const getLabelValue = (item) => item.labelId
            ? `${getMessageById(messages, item.labelId)} (${item.count})`
            : `${item.label || ''} (${item.count})`;
        return (
            <FormGroup
                controlId={field.id}
            >
                <label><strong>{field.labelId ? getMessageById(messages, field.labelId) : field.label}</strong></label>
                <SelectInfiniteScroll
                    value={currentValues.map((value) => {
                        const selectedFilter = getFilterById(value);
                        return {
                            value,
                            label: selectedFilter ? getLabelValue(selectedFilter) : value
                        };
                    })}
                    multi
                    placeholder={field.placeholderId}
                    onChange={(selected) => {
                        let _selected = selected.map(({ value }) => value);
                        _selected = isFacet ? _selected.concat(otherValues) : _selected;
                        onChange({
                            [filterKey]: _selected
                        });
                    }}
                    loadOptions={({ q, ...params }) => field.loadItems({
                        ...params,
                        ...values, // filter queries
                        ...(q && { topic_contains: q }),
                        page: params.page - 1
                    })
                        .then((response) => {
                            return {
                                ...response,
                                results: response.items.map((item) => ({
                                    ...item,
                                    selectOption: {
                                        value: item.filterValue,
                                        label: getLabelValue(item)
                                    }
                                }))
                            };
                        })}
                />
            </FormGroup>
        );
    }
    if (field.type === 'select') {
        const {
            id: formId,
            labelId,
            label,
            placeholderId,
            description,
            options
        } = field;
        const key = `${id}-${formId}`;
        const filterKey = `filter{${formId}.in}`;

        const currentValues = values[filterKey] || [];

        const optionsProp = { options: options?.map(option => ({ value: option, label: option })) };
        const getFilterLabelById = (value) => filters?.[filterKey + value]?.selectOption?.label || filters?.[filterKey + value]?.label;
        return (
            <FormGroup
                controlId={key}
            >
                <label><strong>{labelId ? getMessageById(messages, labelId) : label}</strong></label>
                <SelectSync
                    value={currentValues.map((value) => ({ value, label: getFilterLabelById(value) || value }))}
                    multi
                    placeholder={placeholderId}
                    onChange={(selected) => {
                        onChange({
                            [filterKey]: selected.map(({ value }) => value)
                        });
                    }}
                    { ...optionsProp }
                />
                {description &&
                <div className="text-muted">
                    {description}
                </div>}
            </FormGroup>
        );
    }
    if (field.type === 'group') {
        return (<Group
            query={values}
            title={field.labelId ? getMessageById(messages, field.labelId) : field.label}
            {...field.loadItems && {loadItems: (params) => field.loadItems({...params, ...values})}}
            items={field.items}
            content={(groupItems) => (
                <FilterItems
                    id={id}
                    items={groupItems}
                    values={values}
                    onChange={onChange}
                    filters={filters}
                    setFilters={setFilters}
                />)
            }
        />);
    }
    if (field.type === 'divider') {
        return <div className="gn-filter-form-divider"></div>;
    }
    if (field.type === 'link') {
        return <div className="gn-filter-form-link"><a href={field.href}>{field.labelId && getMessageById(messages, field.labelId) || field.label}</a></div>;
    }
    if (field.type === 'filter') {
        const filterKey = field.filterKey || "f";
        const customFilters = castArray( values[filterKey] || []);
        const getFilterValue = (item) => item.filterValue || item.id;
        const isFacet = (item) => item.style === 'facet';
        const renderFacet = ({item, active, onChangeFacet, renderChild}) => {
            return (
                <div className="gn-facet-wrapper">
                    <Facet item={item} active={active} onChange={onChangeFacet}/>
                    {item.items && renderChild && <div className="facet-children">{renderChild()}</div>}
                </div>
            );
        };

        const filterChild = () => {
            return field.items && field.items.map((item) => {
                const active = customFilters.find(value => value === getFilterValue(item));
                const onChangeFilter = () => {
                    onChange({
                        f: active
                            ? customFilters.filter(value => value !== getFilterValue(item))
                            : [...customFilters.filter(value => field.id !== value), getFilterValue(item), getFilterValue(field)]
                    });
                };
                return (
                    <div className={'gn-sub-filter-items'} key={item.uuid}>
                        {isFacet(item)
                            ? renderFacet({item, active, onChangeFacet: onChangeFilter})
                            : <Checkbox
                                type="checkbox"
                                checked={!!active}
                                value={getFilterValue(item)}
                                onChange={onChangeFilter}
                            >
                                <Label item={item}/>
                            </Checkbox>
                        }
                    </div>
                );
            } );
        };
        const active = customFilters.find(value => value === getFilterValue(field));
        const parentFilterIds = [
            getFilterValue(field),
            ...(field.items
                ? field.items.map((item) => getFilterValue(item))
                : [])
        ];
        const onChangeFilterParent = () => {
            onChange({
                [filterKey]: active
                    ? customFilters.filter(value => !parentFilterIds.includes(value))
                    : [...customFilters, getFilterValue(field)]
            });
        };
        return isFacet(field)
            ? renderFacet({
                item: field,
                active,
                onChangeFacet: onChangeFilterParent,
                renderChild: filterChild
            }) : (
                <FormGroup controlId={'gn-radio-filter-' + getFilterValue(field)}>
                    <Checkbox
                        type="checkbox"
                        checked={!!active}
                        value={getFilterValue(field)}
                        onChange={onChangeFilterParent}>
                        <Label item={field}/>
                        {filterChild()}
                    </Checkbox>
                </FormGroup>
            );
    }
    if (field.type === 'accordion' && !field.facet && field.id) {
        return (<Accordion
            query={values}
            title={field.labelId ? getMessageById(messages, field.labelId) : field.label}
            identifier={field.id}
            loadItems={(params) => field.loadItems({...params, ...values})}
            items={field.items}
            content={(accordionItems) => (
                <FilterItems
                    id={id}
                    items={accordionItems}
                    values={values}
                    onChange={onChange}
                    filters={filters}
                    setFilters={setFilters}
                />)
            }
        />);
    }
    if (field.type === 'tabs') {
        const key = `${id}-${field.id}`;
        return (
            <Tabs
                identifier={key}
                persistSelection={field.persistSelection}
                tabs={(field?.items || [])?.map((item) => ({
                    title: item.labelId ? getMessageById(messages, item.labelId) : item.label,
                    component: <FilterItems
                        {...item}
                        extentProps={extentProps}
                        timeDebounce={timeDebounce}
                        items={item.items}
                        values={values}
                        filters={filters}
                        setFilters={setFilters}
                        onChange={onChange}
                    />
                }))}
            />
        );
    }
    return null;
}

FilterItem.contextTypes = {
    messages: PropTypes.object
};

function FilterItems({ items, ...props }) {
    return items.map((field, idx) =>
        <FilterItem
            key={field.uuid || `${field.id || ''}-${idx}`}
            {...props}
            field={{
                ...field,
                ...(field.loadItems && {loadItems: (...args) => field.loadItems(...args, props.filters, props.setFilters)})
            }}
        />
    );
}

FilterItems.defaultProps = {
    id: PropTypes.string,
    items: PropTypes.array,
    values: PropTypes.object,
    onChange: PropTypes.func
};

FilterItems.defaultProps = {
    items: [],
    values: {},
    onChange: () => {}
};

export default FilterItems;
