/*
 * ModalHost focus behaviour — the three findings the W2 adversarial pass
 * raised against the W2 remediation itself (epic 2425 W2.5).
 *
 *   R3  two live hosts made Tab un-cycle: each installed its own document
 *       keydown, both preventDefault()ed, and each pulled focus to its OWN
 *       first item, so every Tab press reset focus.
 *   P1  W2's MAJOR#5 focus-restore was fixed only for the DISABLED-invoker
 *       shape. For a REMOVED invoker, restoreFocus skipped it, nearestFocusable
 *       bailed, and focus landed on <body> — the exact outcome the fallback
 *       exists to prevent. W2 nonetheless reported MAJOR#5 closed.
 *
 * SCOPE: these are DOM/behaviour assertions. jsdom has no layout engine, so
 * nothing here says anything about where a dialog paints — that is the
 * Playwright suite's job (tests/e2e/test_paywall_money_path.py).
 *
 * `document.hasFocus()` is false in a headless karma run, which is why the
 * assertions read document.activeElement (which .focus() still moves) rather
 * than relying on focus events firing — the same trap ModalHost's own
 * lastInteractedElement tracker documents.
 */
import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ModalHost, { __openHostCount } from '../components/ModalHost';

function Dialog({ label }) {
    return (
        <div>
            <h2 id={`t-${label}`}>{label}</h2>
            <button data-testid={`${label}-first`}>{`${label} first`}</button>
            <button data-testid={`${label}-last`}>{`${label} last`}</button>
        </div>
    );
}

const pressTab = (shiftKey = false) => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab', keyCode: 9, bubbles: true, cancelable: true, shiftKey
    }));
};

describe('ModalHost — open-host stack (adversarial R3)', () => {
    let mountA;
    let mountB;

    beforeEach(() => {
        mountA = document.createElement('div');
        mountB = document.createElement('div');
        document.body.appendChild(mountA);
        document.body.appendChild(mountB);
    });

    afterEach(() => {
        [mountA, mountB].forEach((m) => {
            ReactDOM.unmountComponentAtNode(m);
            if (m.parentNode) m.parentNode.removeChild(m);
        });
    });

    const renderHost = (mount, label) => {
        act(() => {
            ReactDOM.render(
                <ModalHost testId={`host-${label}`} className="paywall-panel" titleId={`t-${label}`}>
                    <Dialog label={label} />
                </ModalHost>,
                mount
            );
        });
    };

    it('registers and unregisters, so the stack cannot leak across mounts', () => {
        const before = __openHostCount();
        renderHost(mountA, 'a');
        expect(__openHostCount()).toBe(before + 1);
        renderHost(mountB, 'b');
        expect(__openHostCount()).toBe(before + 2);
        act(() => { ReactDOM.unmountComponentAtNode(mountB); });
        expect(__openHostCount()).toBe(before + 1);
        act(() => { ReactDOM.unmountComponentAtNode(mountA); });
        expect(__openHostCount()).toBe(before);
    });

    it('with TWO hosts open, Tab is handled by the TOPMOST only — focus cycles instead of resetting', () => {
        renderHost(mountA, 'a');
        renderHost(mountB, 'b'); // topmost

        const bLast = document.querySelector('[data-testid="b-last"]');
        const bFirst = document.querySelector('[data-testid="b-first"]');
        bLast.focus();
        expect(document.activeElement).toBe(bLast);

        // Tab at the end of the topmost dialog wraps to ITS first item.
        pressTab();
        expect(document.activeElement).toBe(
            bFirst,
            'Tab did not wrap within the topmost dialog — the lower host stole it'
        );

        // THE BUG: host A also handled Tab and yanked focus to a-first. Prove
        // the lower dialog never becomes the focus target.
        expect(document.activeElement).toNotBe(document.querySelector('[data-testid="a-first"]'));

        // And a second Tab still cycles rather than resetting to the same node
        // via the other host — from first, Shift+Tab wraps back to last.
        pressTab(true);
        expect(document.activeElement).toBe(bLast);
    });

    it('once the topmost unmounts, the remaining host handles Tab again', () => {
        renderHost(mountA, 'a');
        renderHost(mountB, 'b');
        act(() => { ReactDOM.unmountComponentAtNode(mountB); });

        const aLast = document.querySelector('[data-testid="a-last"]');
        const aFirst = document.querySelector('[data-testid="a-first"]');
        aLast.focus();
        pressTab();
        expect(document.activeElement).toBe(aFirst);
    });

    it('Escape is DELIBERATELY not gated on topmost — it exits every open dialog', () => {
        // A trapped customer is the failure mode this epic exists to remove, so
        // one Escape closing both is the safe direction. Pinned so a later
        // "consistency" tidy-up does not quietly make Escape topmost-only too.
        let aDismissed = false;
        let bDismissed = false;
        act(() => {
            ReactDOM.render(
                <ModalHost testId="host-a" className="paywall-panel" titleId="t-a"
                    onDismiss={() => { aDismissed = true; }}><Dialog label="a" /></ModalHost>,
                mountA
            );
        });
        act(() => {
            ReactDOM.render(
                <ModalHost testId="host-b" className="paywall-panel" titleId="t-b"
                    onDismiss={() => { bDismissed = true; }}><Dialog label="b" /></ModalHost>,
                mountB
            );
        });
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape', keyCode: 27, bubbles: true, cancelable: true
        }));
        expect(aDismissed).toBe(true);
        expect(bDismissed).toBe(true);
    });
});

describe('ModalHost — focus restore when the invoker is REMOVED (adversarial P1)', () => {
    let mount;
    let invokerHost;

    beforeEach(() => {
        invokerHost = document.createElement('div');
        // A live, focusable element early in document order — the deterministic
        // last-resort target. Without the P1 fix, focus lands on <body> instead.
        invokerHost.innerHTML =
            '<button data-testid="page-first">page first</button>' +
            '<div id="doomed"><button data-testid="doomed-invoker">open</button></div>';
        document.body.insertBefore(invokerHost, document.body.firstChild);
        mount = document.createElement('div');
        document.body.appendChild(mount);
    });

    afterEach(() => {
        ReactDOM.unmountComponentAtNode(mount);
        if (mount.parentNode) mount.parentNode.removeChild(mount);
        if (invokerHost.parentNode) invokerHost.parentNode.removeChild(invokerHost);
    });

    it('a DETACHED invoker no longer dumps focus on <body>', () => {
        const invoker = document.querySelector('[data-testid="doomed-invoker"]');
        // The tracker records interactions from module load, so a real press is
        // what makes this the invoker — not document.activeElement, which is
        // <body> on the real 402 path by the time the dialog mounts.
        invoker.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));

        act(() => {
            ReactDOM.render(
                <ModalHost testId="host-p1" className="paywall-panel" titleId="t-p1">
                    <Dialog label="p1" />
                </ModalHost>,
                mount
            );
        });

        // The invoker's whole subtree is removed while the dialog is open —
        // React swapping a portal out and deleting the control that opened it.
        const doomed = document.getElementById('doomed');
        doomed.parentNode.removeChild(doomed);
        expect(document.contains(invoker)).toBe(false);

        act(() => { ReactDOM.unmountComponentAtNode(mount); });

        expect(document.activeElement).toNotBe(
            document.body,
            'focus was dumped on <body> — a keyboard user loses their place entirely'
        );
        expect(document.activeElement).toBe(
            document.querySelector('[data-testid="page-first"]'),
            'the detached-invoker fallback did not land on the first focusable element'
        );
    });

    it('an ATTACHED invoker still gets focus back (the fix does not override the good path)', () => {
        const invoker = document.querySelector('[data-testid="page-first"]');
        invoker.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
        act(() => {
            ReactDOM.render(
                <ModalHost testId="host-p1b" className="paywall-panel" titleId="t-p1b">
                    <Dialog label="p1b" />
                </ModalHost>,
                mount
            );
        });
        act(() => { ReactDOM.unmountComponentAtNode(mount); });
        expect(document.activeElement).toBe(invoker);
    });
});
