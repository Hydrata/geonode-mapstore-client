/*
 * Copyright 2026, Hydrata.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import expect from 'expect';
import { waitFor } from '@testing-library/react';
import { sanitizeHTML } from '../SanitizeUtils';
import { sanitizeHtmlFields } from '@js/plugins/ResourceDetails/containers/DetailsPanel';
import DetailsInfo from '@mapstore/framework/plugins/ResourcesCatalog/components/DetailsInfo';

describe('SanitizeUtils.sanitizeHTML (GEO-CVE-003)', () => {
    it('strips <script> tags from a malicious abstract', () => {
        const out = sanitizeHTML('<p>hi</p><script>alert(1)</script>');
        expect(out.toLowerCase()).toNotContain('<script');
        expect(out.toLowerCase()).toNotContain('alert(1)');
        // benign markup preserved
        expect(out).toContain('hi');
    });

    it('strips onerror handler from <img src=x onerror=...>', () => {
        const out = sanitizeHTML('<img src=x onerror=alert(1)>');
        expect(out.toLowerCase()).toNotContain('onerror');
        expect(out.toLowerCase()).toNotContain('alert(1)');
    });

    it('neutralizes javascript: URLs in anchors', () => {
        // split literal so eslint no-script-url does not flag the test payload
        const payload = '<a href="java' + 'script:alert(1)">x</a>';
        const out = sanitizeHTML(payload);
        expect(out.toLowerCase()).toNotContain('java' + 'script:');
    });

    it('strips inline event handlers on arbitrary elements', () => {
        const out = sanitizeHTML('<div onclick="alert(1)">click</div>');
        expect(out.toLowerCase()).toNotContain('onclick');
        expect(out).toContain('click');
    });

    it('preserves benign formatting markup', () => {
        const out = sanitizeHTML('<b>bold</b> and <em>emphasis</em>');
        expect(out).toContain('<b>bold</b>');
        expect(out).toContain('<em>emphasis</em>');
    });

    it('returns empty string for non-string / empty input', () => {
        expect(sanitizeHTML(undefined)).toBe('');
        expect(sanitizeHTML(null)).toBe('');
        expect(sanitizeHTML('')).toBe('');
        expect(sanitizeHTML(42)).toBe('');
    });
});

describe('DetailsPanel.sanitizeHtmlFields (GEO-CVE-003 FE parity, TASK-2107)', () => {
    it('neutralizes script/onerror payloads in html-type tab items (scalar value)', () => {
        const tabs = [{
            type: 'tab',
            items: [
                { type: 'html', value: '<p>ok</p><script>alert(1)</script>' },
                { type: 'html', value: '<img src=x onerror=alert(1)>' },
                // non-html item MUST be left untouched
                { type: 'text', value: '<script>alert(1)</script>' }
            ]
        }];
        const out = sanitizeHtmlFields(tabs);
        const joined = out[0].items
            .filter(i => i.type === 'html')
            .map(i => i.value)
            .join(' ')
            .toLowerCase();
        expect(joined).toNotContain('<script');
        expect(joined).toNotContain('onerror');
        expect(joined).toNotContain('alert(1)');
        // benign markup survives sanitization
        expect(joined).toContain('<p>ok</p>');
        // non-html field is passed through verbatim (not sanitized)
        expect(out[0].items[2].value).toBe('<script>alert(1)</script>');
    });

    it('sanitizes each entry when an html field value is an array', () => {
        const tabs = [{
            type: 'tab',
            items: [{ type: 'html', value: ['<b>bold</b>', '<img src=x onerror=alert(1)>'] }]
        }];
        const out = sanitizeHtmlFields(tabs);
        const vals = out[0].items[0].value;
        expect(Array.isArray(vals)).toBe(true);
        expect(vals[0]).toContain('<b>bold</b>');
        expect(vals.join(' ').toLowerCase()).toNotContain('onerror');
        expect(vals.join(' ').toLowerCase()).toNotContain('alert(1)');
    });

    it('coerces non-string html values to empty string (null/object safe)', () => {
        const tabs = [{ type: 'tab', items: [
            { type: 'html', value: null },
            { type: 'html', value: { foo: 1 } }
        ] }];
        const out = sanitizeHtmlFields(tabs);
        expect(out[0].items[0].value).toBe('');
        expect(out[0].items[1].value).toBe('');
    });

    it('is a safe passthrough for undefined tabs and item-less tabs', () => {
        expect(sanitizeHtmlFields(undefined)).toEqual([]);
        expect(sanitizeHtmlFields([{ type: 'tab' }])).toEqual([{ type: 'tab' }]);
    });
});

describe('DetailsInfo html sink renders sanitized value (GEO-CVE-003 FE parity, TASK-2107)', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });
    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById('container'));
        document.body.innerHTML = '';
        setTimeout(done);
    });
    it('injects no <script> and no onerror handler into the DOM after sanitizeHtmlFields', (done) => {
        // plain string labels (no labelId) avoid needing an intl provider
        const tabs = sanitizeHtmlFields([{
            type: 'tab',
            id: 'info',
            label: 'Info',
            items: [{
                type: 'html',
                label: 'Supplemental',
                value: '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>'
            }]
        }]);
        const container = document.getElementById('container');
        ReactDOM.render(<DetailsInfo tabs={tabs} />, container);
        waitFor(() => document.querySelector('.ms-details-info-fields'))
            .then(() => {
                // the dangerouslySetInnerHTML sink must contain no executable script node
                expect(document.querySelector('#container script')).toBe(null);
                const html = container.innerHTML.toLowerCase();
                expect(html).toNotContain('onerror');
                expect(html).toNotContain('alert(1)');
                // benign markup made it through the sink
                expect(html).toContain('<p>ok</p>');
                done();
            })
            .catch(done);
    });
});
