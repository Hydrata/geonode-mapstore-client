
/*
 * Copyright 2023, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import {
    filterFormItemsContainFacet,
    parseIcon,
    updateFilterFormItemsWithFacet
} from '../SearchUtils';

describe('Test Resource Utils', () => {
    it('filterFormItemsContainFacet', () => {
        expect(filterFormItemsContainFacet([ { type: 'group', items: [] } ])).toBe(false);
        expect(filterFormItemsContainFacet([ { type: 'group', items: [] }, { type: 'accordion', facet: 'thesaurus' } ])).toBe(true);
        expect(filterFormItemsContainFacet([ { type: 'group', items: [{ type: 'accordion', facet: 'thesaurus' }] }, { type: 'filter' } ])).toBe(true);
    });
    describe('Test updateFilterFormItemsWithFacet', () => {
        it('test with no facet item in filter form items', () => {
            const formItems = [{name: "1"}, {name: "2"}];
            const items = updateFilterFormItemsWithFacet({formItems});
            expect(items[0].name).toEqual(formItems[0].name);
            expect(items[1].name).toEqual(formItems[1].name);
        });
        it('test with facet item and filter form items', () => {
            const formItems = [{name: "1"}, {style: "facet", type: "accordion", facet: "thesaurus"}];
            const facetItems = [{name: "some-name", filter: "filterkey", label: "label1", type: "thesaurus", config: {style: "facet"}}];
            const items = updateFilterFormItemsWithFacet({formItems, facetItems});
            expect(items.length).toBe(2);
            expect(items[1].name).toBe(facetItems[0].name);
            expect(items[1].key).toBe(facetItems[0].filter);
            expect(items[1].id).toBe(facetItems[0].name);
            expect(items[1].type).toBe("accordion");
            expect(items[1].style).toBe("facet");
            expect(items[1].label).toBe("label1");
            expect(items[1].loadItems).toBeTruthy();
        });
        it('test with facet item by no matching facet', () => {
            const formItems = [{name: "1"}, {style: "facet", type: "accordion", facet: "thesaurus"}];
            const facetItems = [{name: "some-name", filter: "filterkey", label: "label1", type: "owner", config: {style: "facet"}}];
            const items = updateFilterFormItemsWithFacet({formItems, facetItems});
            expect(items.length).toBe(1);
            expect(items[0].name).toEqual(formItems[0].name);
        });
        it('test with nested facet item', () => {
            const config = {style: "facet"};
            const formItems = [{ type: "group", items: [{style: "facet", type: "accordion", facet: "thesaurus"}] }];
            const facetItems = [
                {name: "some-name", filter: "filterkey", label: "label1", type: "thesaurus", config},
                {name: "some-name-2", filter: "filterkey", label: "label2", type: "thesaurus", config}
            ];
            const items = updateFilterFormItemsWithFacet({formItems, facetItems});
            expect(items.length).toBe(1);
            expect(items[0].items.length).toBe(2);
        });
    });
    describe('parseIcon', ()=> {
        it('test with input as string', () => {
            expect(parseIcon("fa-test")).toBe("test");
        });
        it('test with input as object with icon prop', () => {
            expect(parseIcon({icon: "fa-test"})).toBe("test");
        });
        it('test with input as object with fa_class prop', () => {
            expect(parseIcon({fa_class: "fa-test"})).toBe("test");
        });
    });
});
