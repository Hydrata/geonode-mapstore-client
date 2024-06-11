/*
 * Copyright 2023, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {useEffect, useRef} from "react";
import isEqual from "lodash/isEqual";

const deepCompareEquals = (a, b) => {
    return isEqual(a, b);
};

const useDeepCompareMemoize = (value) => {
    const ref = useRef();
    if (!deepCompareEquals(value, ref.current)) {
        ref.current = value;
    }
    return ref.current;
};

export default (callback, dependencies) => {
    useEffect(
        callback,
        dependencies.map(useDeepCompareMemoize)
    );
};
