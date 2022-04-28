import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Modal, Button} from "react-bootstrap";
import ReactDataGrid from 'react-data-grid';
import { Filters } from "react-data-grid-addons";
const {
    NumericFilter,
    AutoCompleteFilter,
    MultiSelectFilter,
    SingleSelectFilter
} = Filters;

import {formatMoney} from '../../Utils/utils';
import {hideSwammDataGrid} from "../actionsSwamm";

class SwammDataGridClass extends React.Component {
    static propTypes = {
        hideSwammDataGrid: PropTypes.func,
        allBmps: PropTypes.array
    };

    static defaultProps = {
    }

    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.state = {};
    }

    componentDidMount() {
    }

    componentDidUpdate() {
    }

    render() {
        return (
            <Modal
                show
                onHide={() => console.log('onHide')}
                style={{
                    marginTop: "50px",
                    width: "100%"
                }}
                dialogClassName="swamm-big-modal"
            >
                <Modal.Header>
                    <Modal.Title>
                        BMP Summary
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div>
                        <ReactDataGrid
                            columns={this.columns}
                            rowGetter={i => this.rows[i]}
                            rowsCount={this.rows.length}
                            minHeight={"75vh"}
                            height={"75vh"}
                            style={{margin: "10px"}}
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        bsStyle="danger"
                        bsSize="small"
                        style={{opacity: "0.7"}}
                        onClick={() => this.props.hideSwammDataGrid()}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
    handleChange(event) {
        console.log('handleChange', event);
    }

    columnDefaults = {
        resizable: true,
        dragable: true,
        width: 150,
        sortable: false
    }

    columnHeaders = [
        { key: 'id', name: 'ID', filterable: true, filterRenderer: NumericFilter },
        { key: 'typeName', name: 'Type' },
        { key: 'organisationName', name: 'Organization'},
        { key: 'n_redratio', name: 'N Reduction Ratio'},
        { key: 'p_redratio', name: 'P Reduction Ratio'},
        { key: 's_redratio', name: 'S Reduction Ratio'},
        { key: 'cost_base', name: 'Cost Base'},
        { key: 'cost_rate_per_footprint_area', name: 'Cost per Footprint Acre'},
        { key: 'cost_rate_per_watershed_area', name: 'Cost per Watershed Acre'},
        { key: 'calculated_footprint_area', name: 'Footprint Area (Acres)'},
        { key: 'calculated_watershed_area', name: 'Watershed Area (Acres)'},
        { key: 'calculated_total_cost', name: 'Total Cost'},
        { key: 'previous_n_load', name: 'Previous N Load (lbs/year)'},
        { key: 'n_load_reduction', name: 'N Load Reduction (lbs/year)'},
        { key: 'new_n_load', name: 'New N Load (lbs/year)'},
        { key: 'previous_p_load', name: 'Previous P Load (lbs/year)'},
        { key: 'p_load_reduction', name: 'P Load Reduction (lbs/year)'},
        { key: 'new_p_load', name: 'New P Load (lbs/year)'},
        { key: 'previous_s_load', name: 'Previous S Load (lbs/year)'},
        { key: 's_load_reduction', name: 'S Load Reduction (lbs/year)'},
        { key: 'new_s_load', name: 'New S Load (lbs/year)'},
        { key: 'cost_per_lbs_n_reduced', name: '$ per pound N Reduction'},
        { key: 'cost_per_lbs_p_reduced', name: '$ per pound P Reduction'},
        { key: 'cost_per_ton_s_reduced', name: '$ per pound S Reduction'}
    ];

    columns = this.columnHeaders.map(col => (
        {
            ...this.columnDefaults,
            ...col
        }
    ));

    rows = this.props.allBmps.map(bmp => {
        return {
            ...bmp,
            typeName: bmp.type_data.name,
            organisationName: bmp.type_data.organisation.name,
            n_redratio: bmp.override_n_redratio?.toPrecision(2),
            p_redratio: bmp.override_p_redratio?.toPrecision(2),
            s_redratio: bmp.override_s_redratio?.toPrecision(2),
            cost_base: formatMoney(bmp.override_cost_base, 0),
            cost_rate_per_footprint_area: formatMoney(bmp.override_cost_rate_per_footprint_area, 0),
            cost_rate_per_watershed_area: formatMoney(bmp.override_cost_rate_per_watershed_area, 0),
            calculated_footprint_area: formatMoney(bmp.calculated_footprint_area, 0),
            calculated_watershed_area: formatMoney(bmp.calculated_watershed_area, 0),
            calculated_total_cost: formatMoney(bmp.calculated_total_cost, 0),
            previous_n_load: bmp.previous_n_load?.toFixed(0),
            n_load_reduction: bmp.n_load_reduction?.toFixed(0),
            new_n_load: bmp.new_n_load?.toFixed(0),
            previous_p_load: bmp.previous_p_load?.toFixed(0),
            p_load_reduction: bmp.p_load_reduction?.toFixed(0),
            new_p_load: bmp.new_p_load?.toFixed(0),
            previous_s_load: bmp.previous_s_load?.toFixed(0),
            s_load_reduction: bmp.s_load_reduction?.toFixed(0),
            new_s_load: bmp.new_s_load?.toFixed(0),
            cost_per_lbs_n_reduced: formatMoney(bmp.cost_per_lbs_n_reduced, 0),
            cost_per_lbs_p_reduced: formatMoney(bmp.cost_per_lbs_p_reduced, 0),
            cost_per_ton_s_reduced: formatMoney(bmp.cost_per_ton_s_reduced, 0)
        };
    })
}

const mapStateToProps = (state) => {
    return {
        mapId: state?.projectManager?.data?.base_map,
        allBmps: state?.swamm?.allBmps
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        hideSwammDataGrid: () => dispatch(hideSwammDataGrid())
    };
};

const SwammDataGrid = connect(mapStateToProps, mapDispatchToProps)(SwammDataGridClass);


export {
    SwammDataGrid
};
