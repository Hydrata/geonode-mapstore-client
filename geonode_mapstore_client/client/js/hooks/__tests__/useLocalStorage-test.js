
/*
 * Copyright 2021, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import expect from 'expect';
import useLocalStorage from '@js/hooks/useLocalStorage';

function MockApp({ key, value }) {

    const [inTest, setInTest] = useLocalStorage(key);
    setInTest(value);
    return (
        <div className="MockApp">
            <p id="lsValue" >{inTest}</p>
        </div>
    );

}
export default MockApp;


describe('Test useLocalStorage', () => {
    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });
    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });

    it('Test componet is rendered', () => {
        ReactDOM.render(<MockApp key="test_key" value="test_value" />
            , document.getElementById("container"));
        const container = document.getElementById('container');
        const el = container.querySelector('.MockApp');
        expect(el).toExist();
    });

    it('Test component localStorage props', () => {
        ReactDOM.render(<MockApp key="test_key" value="test_value" />, document.getElementById("container"));
        const el = document.getElementsByClassName('MockApp');
        expect(el).toExist();
        const element = el[0].childNodes[0];
        expect(element).toExist();
        expect(element.innerHTML).toBe('test_value');
    });


});
