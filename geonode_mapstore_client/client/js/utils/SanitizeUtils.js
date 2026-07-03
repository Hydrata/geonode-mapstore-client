/*
 * Copyright 2026, Hydrata.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize an untrusted HTML string before it is passed to
 * `dangerouslySetInnerHTML`. Neutralizes stored-XSS vectors (script tags,
 * inline event handlers such as onerror/onclick, javascript: URLs) while
 * preserving benign formatting markup (GEO-CVE-003, TASK-2068).
 *
 * @param {string} dirty untrusted HTML (e.g. a resource abstract)
 * @return {string} sanitized HTML safe for dangerouslySetInnerHTML
 */
export const sanitizeHTML = (dirty) => {
    if (typeof dirty !== 'string' || dirty === '') {
        return '';
    }
    return DOMPurify.sanitize(dirty);
};

export default sanitizeHTML;
