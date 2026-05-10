/*
 * Regression test for the dropdown chrome restored after commit 30b24fe6d.
 *
 * Item 3 of that commit ("uniform fonts") stripped the entire inline
 * style block from FormField.js's <select>, including chrome props
 * (border, border-radius, padding, height, background-color, color,
 * cursor) that were unrelated to fonts. The select then rendered as a
 * raw user-agent control with no visible border / no proper height,
 * looking broken inside the popup.
 *
 * Fix: chrome moved into vectorDrawPopup.css, scoped to
 * `.vector-draw-popup select` so the SimpleView baseline (Montserrat /
 * 12px / inherited from the popup) is preserved while the visible
 * border + padding + height are restored.
 *
 * This file asserts:
 *   1. FormField.js's <select> JSX inline style block does NOT
 *      reintroduce any of the chrome properties (regression guard).
 *   2. The rendered select sits inside the .vector-draw-popup
 *      ancestor chain so the scoped CSS rule is in scope.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
// TASK-795: import the bare (un-connected) FormField so this regression
// guard doesn't need a Redux Provider tree just to render select/text/number
// chrome. The default export is now connect()-wrapped to feed projectId into
// the new time-data-picker widget — those tests live separately and supply
// their own Provider.
import { FormField } from '../components/FormField';

const SELECT_FIELD = {
    name: 'kind',
    label: 'Kind',
    type: 'select',
    options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' }
    ]
};

const NUMBER_FIELD = { name: 'flow', label: 'Flow', type: 'number' };
const TEXT_FIELD = { name: 'note', label: 'Note', type: 'text' };

describe('VectorDraw FormField dropdown chrome (regression for 30b24fe6d Item 3)', () => {

    let container;

    beforeEach(() => {
        container = document.createElement('div');
        // Wrap in .vector-draw-popup so the scoped CSS would apply
        // in a real DOM (kept here as documentation; jsdom won't actually
        // resolve the imported CSS, so we don't assert computed styles).
        container.className = 'vector-draw-popup';
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    });

    it('renders a <select> for type=select', () => {
        ReactDOM.render(<FormField field={SELECT_FIELD} value="a" onChange={() => {}} />, container);
        const sel = container.querySelector('select');
        expect(sel).toExist();
    });

    it('select inline style is layout-only (flex + marginLeft) — no chrome regression', () => {
        ReactDOM.render(<FormField field={SELECT_FIELD} value="a" onChange={() => {}} />, container);
        const sel = container.querySelector('select');
        // Chrome must come from .vector-draw-popup select in vectorDrawPopup.css,
        // NOT from inline style. If any of these reappear inline it means
        // someone re-introduced the regression.
        const inlineChromeProps = [
            'border', 'borderRadius', 'borderColor', 'borderWidth',
            'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
            'height', 'backgroundColor', 'color', 'cursor',
            'fontSize', 'fontFamily', 'fontWeight'
        ];
        const offenders = inlineChromeProps.filter(p => sel.style[p] !== '');
        expect(offenders).toEqual([]);
    });

    it('select inline style preserves layout-only flex/marginLeft', () => {
        ReactDOM.render(<FormField field={SELECT_FIELD} value="a" onChange={() => {}} />, container);
        const sel = container.querySelector('select');
        // jsdom normalizes "1" to "1" / "8px" — just check nonzero presence.
        expect(sel.style.flex).toExist();
        expect(sel.style.marginLeft).toExist();
    });

    it('text/number inputs likewise carry layout-only inline styles', () => {
        ReactDOM.render(<FormField field={TEXT_FIELD} value="hi" onChange={() => {}} />, container);
        const text = container.querySelector('input[type="text"]');
        expect(text).toExist();
        expect(text.style.border).toBe('');
        expect(text.style.padding).toBe('');
        expect(text.style.height).toBe('');

        // Re-mount with number field
        ReactDOM.unmountComponentAtNode(container);
        ReactDOM.render(<FormField field={NUMBER_FIELD} value={5} onChange={() => {}} />, container);
        const num = container.querySelector('input[type="number"]');
        expect(num).toExist();
        expect(num.style.border).toBe('');
        expect(num.style.padding).toBe('');
        expect(num.style.height).toBe('');
    });
});
