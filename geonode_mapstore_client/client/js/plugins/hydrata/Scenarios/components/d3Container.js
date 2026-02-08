import React from "react";
import ForceGraph3D from "react-force-graph-3d";
import {CSS2DRenderer} from "three-css2drender";
import * as THREE from 'three';
const PropTypes = require('prop-types');
import {connect} from "react-redux";
import '../scenarios.css';

class DagContainerClass extends React.PureComponent {
    static propTypes = {
        data: PropTypes.array,
        selectedScenario: PropTypes.object
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.graphContainer = React.createRef();
    }

    componentDidMount() {
    }

    componentDidUpdate() {
    }

    onClick = () => {
        console.log('clicked graph');
    };

    render() {
        // const extraRenderers = [new CSS2DRenderer()];
        return (
            <div style={{'border': '1px white solid', 'width': '100%'}} ref={this.graphContainer}>
                <ForceGraph3D
                    // extraRenderers={extraRenderers}
                    graphData={this.props.data}
                    width={this.graphContainer?.current?.offsetWidth}
                    height={600}
                    backgroundColor={'#00000080'}
                    nodeVal={'value'}
                    nodeLabel={false}
                    nodeOpacity={0.90}
                    nodeResolution={16}
                    nodeAutoColorBy={'group'}
                    onNodeDragEnd={node => {
                        node.fx = node.x;
                        node.fy = node.y;
                        node.fz = node.z;
                    }}
                    // nodeThreeObject={node => {
                    //     const nodeEl = document.createElement('div');
                    //     nodeEl.textContent = node.name;
                    //     nodeEl.style.color = 'white';
                    //     nodeEl.style.marginTop = '18px';
                    //     nodeEl.className = 'node-label';
                    //     return new THREE.CSS2DObject(nodeEl);
                    // }}
                    onNodeClick={node => {
                        console.log('node:', node);
                    }}
                    // nodeThreeObjectExtend
                    linkColor={'red'}
                    linkOpacity={0.90}
                    linkWidth={1}
                    linkCurvature={[0.05]}
                    linkAutoColorBy={'group'}
                    linkDirectionalArrowLength={6}
                    linkDirectionalParticles={0.5}
                    linkDirectionalParticleWidth={3}
                />
            </div>
        );
    }

    handleChange = (e) => {
        console.log('handleChange', e);
    }
}

const mapStateToProps = (state) => {
    let data = {"nodes": [], "links": []};
    const latestResult = state?.scenarios?.selectedScenario?.latest_result || {};
    let nodesList = latestResult[Object.keys(latestResult)?.[0]] || ["asx_200", "vegetation_structure", "radiation"];
    console.log('latestResult:', latestResult);
    console.log('nodesList:', nodesList);
    // case for SKAI API:
    if (typeof(nodesList?.[0]) === 'string') {
        data.nodes = nodesList?.map((d, index) => {
            return {
                "id": index,
                "name": d
            };
        });
        for (let i = 0; i < nodesList.length - 1; i++) {
            data.links.push({
                "id": i,
                "source": i,
                "target": i + 1
            });
        }
    }
    // case for well-formed nodes & links:
    // debugger;
    if (Array.isArray(latestResult?.nodes) && Array.isArray(latestResult?.links)) {
        data = latestResult;
        if (!data.nodes[0]?.id) {
            console.log('Array.isArray data:', data);
            data.nodes.map((node, index) => {
                data.links.map((link) => {
                    if (link.source === node.name) {
                        link.source = index;
                    }
                    if (link.target === node.name) {
                        link.target = index;
                    }
                });
                node.id = index;
            });
        }
    }
    console.log('data:', data);
    return {
        mapId: state?.projectManager?.data?.base_map,
        projectId: state?.projectManager?.data?.id,
        selectedScenario: state?.scenarios?.selectedScenario,
        data: data
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
    };
};

const DagContainer = connect(mapStateToProps, mapDispatchToProps)(DagContainerClass);

export {
    DagContainer
};
