/*
 * Copyright 2026, Hydrata.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import { sanitizeHTML } from '../SanitizeUtils';

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
