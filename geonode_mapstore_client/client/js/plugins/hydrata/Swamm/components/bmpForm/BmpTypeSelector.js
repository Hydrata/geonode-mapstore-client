import React from "react";

const BmpTypeSelector = ({
    bmpTypeGroups,
    bmpTypes,
    expandedBmpTypeGroupName,
    setExpandedBmpTypeGroupName,
    changingBmpType,
    setChangingBmpType,
    handleBmpChange
}) => (
    <React.Fragment>
        <div style={{textAlign: "left"}}>
            <h5>Select a BMP Type...</h5>
            {bmpTypeGroups?.map((group) => {
                return (
                    <div
                        key={`group-${group}`}
                        style={{
                            textAlign: "left",
                            marginLeft: 0,
                            marginBottom: "3px",
                            padding: "3px",
                            border: "1px solid var(--sv-section-border, rgba(255, 255, 255, 0.6))",
                            borderRadius: "var(--sv-card-radius, 4px)"
                        }}
                    >
                        <span
                            style={{marginLeft: "15px"}}
                            className={"btn glyphicon sv-bmp-type-group-glyph" + (expandedBmpTypeGroupName === group[0] ? " glyphicon-chevron-down sv-bmp-type-group-bottom-margin" : " glyphicon-chevron-right")}
                            onClick={
                                expandedBmpTypeGroupName === group[0] ?
                                    () => setExpandedBmpTypeGroupName(null) :
                                    () => setExpandedBmpTypeGroupName(group[0])
                            }
                        />
                        <span className="sv-bmp-type-group-name">
                            {group[1]}
                        </span>
                        {
                            expandedBmpTypeGroupName === group[0] ?
                                bmpTypes
                                    .filter(bmpType => bmpType.group_name === group[0])
                                    .map(bmpType => {
                                        return (
                                            <div
                                                key={`bmpType-${bmpType?.name}`}
                                                style={{
                                                    marginLeft: "30px"
                                                }}
                                            >
                                                <input
                                                    id={`bmp-type-selector-box-${bmpType?.name}`}
                                                    type={'radio'}
                                                    name={'bmpType'}
                                                    value={bmpType?.name}
                                                    onChange={handleBmpChange}
                                                />
                                                <label
                                                    htmlFor={`bmp-type-selector-box-${bmpType?.name}`}
                                                    style={{marginLeft: "6px", verticalAlign: "middle"}}
                                                >
                                                    {bmpType?.name}
                                                </label>
                                            </div>
                                        );
                                    })
                                : null
                        }
                    </div>
                );
            })}
        </div>
        {changingBmpType ?
            <button
                type={'button'}
                className={'sv-swamm-button'}
                style={{marginTop: "20px", backgroundColor: "darkgreen"}}
                onClick={() => setChangingBmpType(false)}
            >
                Accept
            </button> :
            null
        }
    </React.Fragment>
);

export { BmpTypeSelector };
