/*
 * Copyright 2023, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import expect from 'expect';
import ReactDOM from 'react-dom';

import Accordion from '../Accordion';

describe('Accordion test', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });

    it('render Accordion - default', () => {
        ReactDOM.render(<Accordion />, document.getElementById("container"));
        const accordion = document.querySelector('.gn-accordion');
        expect(accordion).toBeTruthy();
    });
    it('render Accordion - with props', () => {
        ReactDOM.render(<Accordion title="Test" />, document.getElementById("container"));
        const accordion = document.querySelector('.gn-accordion');
        expect(accordion).toBeTruthy();

        const accordionTitle = accordion.querySelector('.accordion-title-label');
        expect(accordionTitle).toBeTruthy();
        expect(accordionTitle.innerText).toBe('Test');

        const accordionTitleBtn = accordionTitle.querySelector('button');
        expect(accordionTitleBtn).toBeTruthy();
    });
});
