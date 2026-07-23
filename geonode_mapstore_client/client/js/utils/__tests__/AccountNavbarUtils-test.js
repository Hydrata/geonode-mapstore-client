/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import { initAccountNavbarItem } from '../AccountNavbarUtils';

// TASK-2423 (epic 2359 W4.5) — navbar user-menu 'Account' entry point.
// The item is server-rendered Django-template HTML (paywall_enabled-gated);
// this module is the bridge that (a) shows it map-pages-only (hash-driven,
// mirrors catalogue.html's toggleFooterOnMap) and (b) dispatches into the
// MapStore2 Redux store via window.MapStoreAPI.triggerAction on click.

function makeElement() {
    return {
        style: {},
        listeners: {},
        addEventListener(type, handler) {
            this.listeners[type] = handler;
        }
    };
}

function makeDoc({ withItem = true, withWrapper = true } = {}) {
    const item = withItem ? makeElement() : null;
    const wrapper = withWrapper ? makeElement() : null;
    return {
        getElementById: (id) => {
            if (id === 'gn-navbar-account-item') {
                return item;
            }
            if (id === 'gn-navbar-account-item-wrapper') {
                return wrapper;
            }
            return null;
        },
        _item: item,
        _wrapper: wrapper
    };
}

function makeWin(hash) {
    return {
        location: { hash },
        listeners: {},
        addEventListener(type, handler) {
            this.listeners[type] = handler;
        },
        MapStoreAPI: undefined
    };
}

describe('Test AccountNavbarUtils', () => {

    it('is a no-op when the item element is not in the DOM (paywall flag off)', () => {
        const doc = makeDoc({ withItem: false });
        const win = makeWin('#/map/1391');
        expect(() => initAccountNavbarItem(win, doc)).toNotThrow();
        expect(Object.keys(win.listeners).length).toBe(0);
    });

    it('shows the wrapper immediately on a map-page hash', () => {
        const doc = makeDoc();
        const win = makeWin('#/map/1391');
        initAccountNavbarItem(win, doc);
        expect(doc._wrapper.style.display).toBe('');
    });

    it('hides the wrapper immediately on a non-map-page hash', () => {
        const doc = makeDoc();
        const win = makeWin('#/dataset/5');
        initAccountNavbarItem(win, doc);
        expect(doc._wrapper.style.display).toBe('none');
    });

    it('re-toggles visibility on hashchange', () => {
        const doc = makeDoc();
        const win = makeWin('#/dataset/5');
        initAccountNavbarItem(win, doc);
        expect(doc._wrapper.style.display).toBe('none');

        win.location.hash = '#/map/1391';
        win.listeners.hashchange();
        expect(doc._wrapper.style.display).toBe('');

        win.location.hash = '#/dataset/5';
        win.listeners.hashchange();
        expect(doc._wrapper.style.display).toBe('none');
    });

    it('dispatches SET_MEMBERSHIP_PANEL + SET_MEMBERSHIP_PANEL_TAB(billing) on click when MapStoreAPI is ready', () => {
        const doc = makeDoc();
        const win = makeWin('#/map/1391');
        const triggerAction = expect.createSpy();
        win.MapStoreAPI = { ready: true, triggerAction };
        initAccountNavbarItem(win, doc);

        const preventDefault = expect.createSpy();
        doc._item.listeners.click({ preventDefault });

        expect(preventDefault).toHaveBeenCalled();
        expect(triggerAction.calls.length).toBe(2);
        expect(triggerAction.calls[0].arguments[0]).toEqual({ type: 'SET_MEMBERSHIP_PANEL', visible: true });
        expect(triggerAction.calls[1].arguments[0]).toEqual({ type: 'SET_MEMBERSHIP_PANEL_TAB', tab: 'billing' });
    });

    it('waits for mapstore:ready before dispatching when MapStoreAPI is not ready yet', () => {
        const doc = makeDoc();
        const win = makeWin('#/map/1391');
        initAccountNavbarItem(win, doc);

        const preventDefault = expect.createSpy();
        expect(() => doc._item.listeners.click({ preventDefault })).toNotThrow();
        expect(preventDefault).toHaveBeenCalled();
        expect(win.listeners['mapstore:ready']).toExist();

        const triggerAction = expect.createSpy();
        win.listeners['mapstore:ready']({ detail: { ready: true, triggerAction } });

        expect(triggerAction.calls.length).toBe(2);
        expect(triggerAction.calls[0].arguments[0]).toEqual({ type: 'SET_MEMBERSHIP_PANEL', visible: true });
        expect(triggerAction.calls[1].arguments[0]).toEqual({ type: 'SET_MEMBERSHIP_PANEL_TAB', tab: 'billing' });
    });

});
