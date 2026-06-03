/**
 * Tests for the shared ConfirmOverlay component (TASK-1438).
 *
 * Covers the props contract: message, onConfirm, onCancel, confirmLabel,
 * confirmStyle, cancelLabel, buttonClassName, confirmClassName,
 * wrapperClassName, wrapperStyle.
 */
import React from 'react';
import expect from 'expect';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';
import ConfirmOverlay from '../ConfirmOverlay';

describe('ConfirmOverlay (TASK-1438)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    function render(props) {
        act(() => {
            ReactDOM.render(<ConfirmOverlay {...props} />, container);
        });
    }

    describe('default rendering', () => {
        it('renders the default message when no message prop is given', () => {
            render({ onConfirm: () => {}, onCancel: () => {} });
            expect(container.textContent).toContain('This action can not be undone. Are you sure?');
        });

        it('renders Cancel and Delete buttons by default', () => {
            render({ onConfirm: () => {}, onCancel: () => {} });
            const buttons = container.querySelectorAll('button');
            expect(buttons.length).toBe(2);
            expect(buttons[0].textContent).toBe('Cancel');
            expect(buttons[1].textContent).toBe('Delete');
        });

        it('does NOT add a wrapper div when wrapperClassName is absent', () => {
            render({ onConfirm: () => {}, onCancel: () => {} });
            // No wrapping div with a class — only the container div itself exists
            const divsWithClass = container.querySelectorAll('div[class]');
            expect(divsWithClass.length).toBe(0);
        });
    });

    describe('custom props', () => {
        it('renders a custom message', () => {
            render({ message: 'Are you really sure?', onConfirm: () => {}, onCancel: () => {} });
            expect(container.textContent).toContain('Are you really sure?');
        });

        it('renders a custom confirmLabel', () => {
            render({ confirmLabel: 'Remove', onConfirm: () => {}, onCancel: () => {} });
            const buttons = container.querySelectorAll('button');
            expect(buttons[1].textContent).toBe('Remove');
        });

        it('renders a custom cancelLabel', () => {
            render({ cancelLabel: 'Keep editing', onConfirm: () => {}, onCancel: () => {} });
            const buttons = container.querySelectorAll('button');
            expect(buttons[0].textContent).toBe('Keep editing');
        });

        it('applies buttonClassName to both buttons', () => {
            render({ buttonClassName: 'swamm-button', onConfirm: () => {}, onCancel: () => {} });
            const buttons = container.querySelectorAll('button.swamm-button');
            expect(buttons.length).toBe(2);
        });

        it('appends confirmClassName to the confirm button only', () => {
            render({ buttonClassName: 'swamm-button', confirmClassName: 'swamm-bmp-delete-confirm-btn', onConfirm: () => {}, onCancel: () => {} });
            expect(container.querySelector('.swamm-bmp-delete-confirm-btn')).toExist();
            const cancelBtn = container.querySelectorAll('button')[0];
            expect(cancelBtn.className).toNotContain('swamm-bmp-delete-confirm-btn');
        });

        it('applies confirmStyle to the confirm button', () => {
            render({ confirmStyle: {backgroundColor: 'darkorange'}, onConfirm: () => {}, onCancel: () => {} });
            const confirmBtn = container.querySelectorAll('button')[1];
            expect(confirmBtn.style.backgroundColor).toBe('darkorange');
        });

        it('wraps content in a div when wrapperClassName is provided', () => {
            render({ wrapperClassName: 'hydrology-delete-confirm', onConfirm: () => {}, onCancel: () => {} });
            const wrapper = container.querySelector('.hydrology-delete-confirm');
            expect(wrapper).toExist();
            const buttons = wrapper.querySelectorAll('button');
            expect(buttons.length).toBe(2);
        });
    });

    describe('callbacks', () => {
        it('calls onCancel when Cancel is clicked', () => {
            let cancelled = false;
            render({ onConfirm: () => {}, onCancel: () => { cancelled = true; } });
            act(() => { container.querySelectorAll('button')[0].click(); });
            expect(cancelled).toBe(true);
        });

        it('calls onConfirm when the confirm button is clicked', () => {
            let confirmed = false;
            render({ onConfirm: () => { confirmed = true; }, onCancel: () => {} });
            act(() => { container.querySelectorAll('button')[1].click(); });
            expect(confirmed).toBe(true);
        });
    });

    describe('hydrology usage (wrapperClassName + hydrology-button)', () => {
        it('matches the hydrologyListDetailContainer pattern exactly', () => {
            let deleted = false;
            render({
                wrapperClassName: 'hydrology-delete-confirm',
                buttonClassName: 'hydrology-button',
                confirmClassName: 'hydrology-delete-confirm-btn',
                onCancel: () => {},
                onConfirm: () => { deleted = true; },
                confirmLabel: 'Delete'
            });
            const wrapper = container.querySelector('.hydrology-delete-confirm');
            expect(wrapper).toExist();
            const confirmBtn = wrapper.querySelector('.hydrology-delete-confirm-btn');
            expect(confirmBtn).toExist();
            act(() => { confirmBtn.click(); });
            expect(deleted).toBe(true);
        });
    });
});
