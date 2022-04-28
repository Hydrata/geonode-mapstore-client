import React from "react";
const PropTypes = require('prop-types');
import * as d3 from "d3";

import Axis from "./Axis";

class Dag extends React.PureComponent {
    static propTypes = {
        data: PropTypes.array,
        width: PropTypes.number,
        height: PropTypes.number,
        x: PropTypes.number,
        y: PropTypes.number
    }
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
    onTick() {
        const linksRepr = d3.select('svg')
            .selectAll('line')
            .data(this.props?.data?.links);
        linksRepr.enter()
            .append('line')
            .attr("stroke-width", d => Math.sqrt(d.value))
            .attr("stroke", "red")
            .attr("stroke-opacity", 0.6)
            .merge(linksRepr)
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        linksRepr.exit().remove();
        const nodesRepr = d3.select('svg')
            .selectAll('circle')
            .data(this.props?.data?.nodes);
        nodesRepr.enter()
            .append('circle')
            .attr('fill', 'yellow')
            .attr('r', 3)
            .merge(nodesRepr)
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        nodesRepr.exit().remove();
        // const labelsRepr = d3.select('svg')
        //     .selectAll('text')
        //     .data(this.props.data.nodes);
        // labelsRepr.enter()
        //     .append("text")
        //     .text(function(d) { return d.id; })
        //     .style("text-anchor", "left")
        //     .style("fill", "yellow")
        //     .style("font-family", "Arial")
        //     .style("font-size", 12)
        //     .merge(labelsRepr)
        //     .attr('x',  d => d.x + 10)
        //     .attr('y', d => d.y + 10);
        // labelsRepr.exit().remove();
    }

    static getDerivedStateFromProps(props, state) {
        const { xScale, yScale } = state;
        xScale.range([0, props.width]);
        yScale.range([props.height, 0]);

        return {
            ...state,
            yScale,
            xScale
        };
    }

    render() {
        const simulation = d3.forceSimulation(this.props.data.nodes)
            .force("link", d3.forceLink(this.props.data.links).id(d => d.id))
            .force('charge', d3.forceManyBody().strength(-30))
            .force('center', d3.forceCenter(this.props.width / 2, this.props.height / 2))
            .on('tick', this.onTick);
        return (
            <g transform={`translate(${this.props.x}, ${this.props.y})`}>
                <Axis x={0} y={0} scale={this.state.yScale} type="Left" />
                <Axis x={0} y={this.props.height} scale={this.state.xScale} type="Bottom" />
            </g>
        );
    }
}

export default Dag;
