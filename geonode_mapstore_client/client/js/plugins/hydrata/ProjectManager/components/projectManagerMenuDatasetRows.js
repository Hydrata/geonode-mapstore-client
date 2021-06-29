import React from "react";
import {setMenuGroup} from "../actionsProjectManager";
import {connect} from "react-redux";
import {MenuDatasetRow} from "./projectManagerMenuDatasetRow";
const PropTypes = require('prop-types');

const rowsStyle = {
    borderTop: "1px solid #ffffffad"
};


const openMenuGroupSelector = (state) => state?.projectManager?.openMenuGroup;

class MenuDatasetRowsClass extends React.Component {
    static propTypes = {
        menuDatasets: PropTypes.array,
        openMenuGroup: PropTypes.string,
        baseMaps: PropTypes.array
    };

    constructor(props) {
        super(props);
    }

    render() {
        if (this.props.openMenuGroup.id_label === 'basemaps') {
            return (
                <div style={rowsStyle}>
                    {this.props.baseMaps.map((layer) => (
                        <MenuDatasetRow layer={layer}/>
                    ))}
                </div>
            );
        }
        if (this.props.menuDatasets?.length === 0) {
            return (
                <div style={rowsStyle}>
                    <MenuDatasetRow dataset={null}/>
                </div>
            );
        }
        return (
            <div style={rowsStyle}>
                {this.props.menuDatasets?.map((dataset) => (
                    <MenuDatasetRow dataset={dataset}/>
                ))}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    // debugger;
    return {
        openMenuGroup: openMenuGroupSelector(state),
        menuDatasets: state?.projectManager?.data?.dataset_set.filter((dataset) => {
            return dataset?.mapstore_menu_group?.id_label === openMenuGroupSelector(state)?.id_label;
        }),
        baseMaps: state?.layers?.flat.filter((layer) => {
            return layer.group === 'background';
        })
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setMenuGroup: (menuGroup) => dispatch(setMenuGroup(menuGroup))
    };
};

const MenuDatasetRows = connect(mapStateToProps, mapDispatchToProps)(MenuDatasetRowsClass);


export {
    MenuDatasetRows
};
