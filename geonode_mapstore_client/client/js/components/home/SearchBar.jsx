/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useRef } from 'react';
import { FormControl, ListGroup, InputGroup, Button, Spinner } from 'react-bootstrap-v1';
import FaIcon from '@js/components/home/FaIcon';
import useDetectClickOut from '@js/hooks/useDetectClickOut';
import debounce from 'lodash/debounce';
function SearchBar({
    value,
    loading,
    debounceTime,
    suggestions,
    onChange,
    onFetchSuggestions,
    style,
    append,
    children,
    onClearSuggestions,
    disableSuggestions
}) {
    const [ outline, setOutline ] = useState(false);
    const [ text, setText ] = useState(value);
    const suggestionsNode = useDetectClickOut({
        disabled: suggestions.length === 0,
        onClickOut: onClearSuggestions
    });
    const textValue = useRef();
    textValue.current = text;

    useEffect(() => {
        if (value !== textValue.current) {
            setText(value);
        }
    }, [ value ]);

    const updateSuggestions = useRef();

    useEffect(() => {
        updateSuggestions.current = debounce((newValue) => {
            onFetchSuggestions(newValue);
        }, debounceTime);
        return () => {
            updateSuggestions.current.cancel();
        };
    }, []);

    function handleInputChange(newValue) {
        setText(newValue);
        if (newValue && !disableSuggestions) {
            updateSuggestions.current.cancel();
            updateSuggestions.current(newValue);
        }
    }

    function handleChange(newValue) {
        onChange(newValue);
        setText(newValue);
    }

    function handleKeyDown(newValue, event) {
        if (event.key === 'Enter') {
            handleChange(newValue);
        }
    }

    return (
        <div
            className={`gn-search-bar ${ outline ? ' focus' : ''}`} style={style}>
            <InputGroup>
                <InputGroup.Prepend>
                    {text &&
                    <Button
                        onClick={() => handleChange('')}
                        variant="default">
                        <FaIcon name="times" />
                    </Button>}
                    <Button
                        onClick={() => handleChange(text)}
                        variant="default">
                        {loading
                            ? <Spinner animation="border" size="sm">
                                <span className="sr-only">Loading...</span>
                            </Spinner>
                            : <FaIcon name="search" />}
                    </Button>
                </InputGroup.Prepend>
                <FormControl
                    placeholder="Search"
                    aria-label="Recipient's username"
                    aria-describedby="basic-addon2"
                    value={text}
                    onKeyDown={event => handleKeyDown(text, event)}
                    onChange={event => handleInputChange(event.target.value)}
                    onFocus={() => setOutline(true)}
                    onBlur={() => setOutline(false)}
                    style={{
                        outline: 'none',
                        boxShadow: 'none'
                    }}
                />
                <InputGroup.Append>
                    {append}
                </InputGroup.Append>
            </InputGroup>
            {suggestions.length > 0 &&
            <div
                ref={suggestionsNode}
                className="gn-suggestions"
            >
                <div className="gn-suggestions-header">
                    <Button
                        onClick={() => onClearSuggestions()}
                        variant="default">
                        <FaIcon name="times" />
                    </Button>
                </div>
                <ListGroup>
                    {suggestions.map(suggestion => {
                        return (
                            <ListGroup.Item
                                key={suggestion.id}
                                action={!loading}
                                onClick={() => handleChange(suggestion.value)}
                            >
                                {suggestion.label}
                            </ListGroup.Item>
                        );
                    })}
                </ListGroup>
            </div>}
            {children}
        </div>
    );
}

SearchBar.defaultProps = {
    value: '',
    loading: false,
    debounceTime: 0,
    suggestions: [],
    onChange: () => {},
    onFetchSuggestions: () => {},
    style: {}
};

export default SearchBar;
