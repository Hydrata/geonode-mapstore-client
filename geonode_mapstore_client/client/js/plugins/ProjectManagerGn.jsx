import React, { useEffect, useState, setState } from 'react';
import { createPlugin } from '../../MapStore2/web/client/utils/PluginsUtils';
import projectManagerGn from "../reducers/projectManagerGn";
import fetchProjectManagerConfig from "../actions/projectManagerGn";

const Component = (props) => {
    // useEffect(fetchProjectManagerConfig);
    useEffect(() => {
        let isMounted = true; // note this flag denote mount status
        fetchProjectManagerConfig().then(data => {
            if (isMounted) setState(data);
        });
        return () => { isMounted = false; }; // use effect cleanup to set flag false, if unmounted
    });
    // const [count, setCount] = useState(0);
    // useEffect(() => {
    //     // Update the document title using the browser API
    //     document.title = `You clicked ${count} times`;
    // });
    return (
        <div>
            nope
            {/*<p>You clicked {count} times</p>*/}
            {/*<button onClick={() => setCount(count + 1)}>*/}
            {/*    Click me*/}
            {/*</button>*/}
        </div>
    );
};

export default createPlugin('ProjectManagerGn', {
    component: Component,
    reducers: {
        projectManagerGn
    }
});
