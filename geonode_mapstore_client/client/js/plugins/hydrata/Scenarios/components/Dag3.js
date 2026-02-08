import React from "react";
import ReactDOM from 'react-dom';
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import * as d3 from "d3";
import Axis from "./Axis";

const width = 960;
const height = 500;
const simulation = d3.forceSimulation()
    .force('charge', d3.forceManyBody().strength(-30))
    .force('center', d3.forceCenter(width / 2, height / 2));

// *****************************************************
// ** d3 functions to manipulate attributes
// *****************************************************

// const enterNode = (selection) => {
//     selection.select('circle')
//         .attr("r", (d) => d?.size);
//         // .merge(selection)
//         // .attr('cx', d => d.x)
//         // .attr('cy', d => d.y);
//         // .call(force.drag);
//
//     selection.select('text')
//         .attr("x", (d) => d?.size + 5)
//         .attr("dy", ".35em");
// };
//
// const updateNode = (selection) => {
//     console.log('selection:', selection);
//     selection.attr("transform", (d) => {
//         console.log(d);
//         return "translate(" + d?.x + "," + d?.y + ")"
//     }
//     );
// };
//
// const enterLink = (selection) => {
//     selection.attr("stroke-width", (d) => d?.size);
// };
//
// const updateLink = (selection) => {
//     selection.attr("x1", (d) => d?.source.x)
//         .attr("y1", (d) => d?.source.y)
//         .attr("x2", (d) => d?.target.x)
//         .attr("y2", (d) => d?.target.y);
// };
//
// const updateGraph = (selection) => {
//     selection.selectAll('.node')
//         .call(updateNode);
//     selection.selectAll('.link')
//         .call(updateLink);
// };

class Node extends React.Component {
    static propTypes = {
        node: PropTypes.object
    }
    componentDidMount() {
        console.log('ReactDOM.findDOMNode(this):', ReactDOM.findDOMNode(this));
        this.d3Node = d3
            .select(ReactDOM.findDOMNode(this))
            .data(this.props.node)
            .select('circle')
            .attr("r", (d) => d?.size)
            .attr("transform", (d) => {
                console.log('Dag3 d', d);
                return "translate(" + Math.random() * 100 + ", " + Math.random() * 100 + ")";
            });
            // .call(enterNode);
    }
    componentDidUpdate() {
        console.log('this.d3Node:', this.d3Node);
        console.log('this.props.node:', this.props.node);
        this.d3Node
            // .data(this.props.node)
            .attr("transform", (d) => {
                console.log('Node d', d);
                return "translate(" + d?.x + "," + d?.y + ")";
            }
            );
            // .call(updateNode);
    }
    render() {
        return (
            <g className="node">
                <circle/>
                <text>{this.props.node.key}</text>
            </g>
        );
    }
}

class Link extends React.Component {
    static propTypes = {
        link: PropTypes.object
    }
    componentDidMount() {
        this.d3Link = d3
            .select(ReactDOM.findDOMNode(this))
            .data(this.props.link)
            .attr("stroke-width", (d) => d?.size);
            // .call(enterLink);
    }
    componentDidUpdate() {
        this.d3Link
            // .data(this.props.link)
            .attr("x1", (d) => d?.source.x)
            .attr("y1", (d) => d?.source.y)
            .attr("x2", (d) => d?.target.x)
            .attr("y2", (d) => d?.target.y);
            // .call(updateLink);
    }
    render() {
        return (
            <line className="link" />
        );
    }
}


export default class Dag3 extends React.Component {
    static propTypes = {
        links: PropTypes.array,
        nodes: PropTypes.array,
        width: PropTypes.number,
        height: PropTypes.number
    }
    onTick = () => {
        // after force calculation starts, call updateGraph
        // which uses d3 to manipulate the attributes,
        // and React doesn't have to go through lifecycle on each tick
        console.log('TICKING this.d3Graph: ', this.d3Graph);
        console.log('this.d3Graph.selectAll(.node)', this.d3Graph.selectAll('.node'));
        this.d3Graph
            .selectAll('.node')
            .merge(this.d3Graph)
            .attr("transform", (d) => {
                console.log('Dag3 d', d);
                return "translate(" + Math.random() * width + ", " + Math.random() * height + ")";
            })
            .selectAll('.link')
            .merge(this.d3Graph)
            .attr("x1", (d) => d?.source.x)
            .attr("y1", (d) => d?.source.y)
            .attr("x2", (d) => d?.target.x)
            .attr("y2", (d) => d?.target.y);
            // .call(updateGraph);
    };
    state = {
        xScale: d3
            .scaleLinear()
            .domain([0, 1])
            .range([0, this.props.width]),
        yScale: d3
            .scaleLinear()
            .domain([0, 1])
            .range([this.props.height, 0])
    };
    componentDidMount() {
        this.d3Graph = d3.select(ReactDOM.findDOMNode(this));
        simulation.nodes(this.props.nodes);
        simulation.force("link", d3.forceLink(this.props.links).id(d => d.key));
        simulation.on('tick', this.onTick());
    }

    componentDidUpdate() {
        // we should actually clone the nodes and links
        // since we're not supposed to directly mutate
        // props passed in from parent, and d3's force function
        // mutates the nodes and links array directly
        // we're bypassing that here for sake of brevity in example

        // start force calculations after
        // React has taken care of enter/exit of elements
        // debugger;
        // simulation.restart();
    }

    render() {
        // use React to draw all the nodes, d3 calculates the x and y
        const nodes = this.props.nodes.map((node) => {
            return (
                <Node key={node.key} node={node} />
            );
        });
        const links = this.props.links.map((link) => {
            return (
                <Link key={link.key} link={link} />
            );
        });
        return (
            <g>
                {links}
                {nodes}
                <Axis x={50} y={50} scale={this.state.yScale} type="Left" />
                <Axis x={50} y={this.props.height + 50} scale={this.state.xScale} type="Bottom" />
            </g>
        );
    }
}
