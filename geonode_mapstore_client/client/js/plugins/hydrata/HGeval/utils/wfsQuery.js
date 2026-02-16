/**
 * Build a WFS GetFeature XML payload with a spatial Contains filter.
 * Uses WFS 1.0.0 with GML point for spatial intersection.
 */
export function buildWfsContainsQuery(layerName, propertyNames, lon, lat) {
    const propElements = propertyNames
        .map(p => `<ogc:PropertyName>${p}</ogc:PropertyName>`)
        .join('');

    return `<wfs:GetFeature
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.opengis.net/wfs"
        xmlns:gml="http://www.opengis.net/gml"
        xmlns:wfs="http://www.opengis.net/wfs"
        xmlns:ogc="http://www.opengis.net/ogc"
        service="WFS" version="1.0.0"
        maxFeatures="1"
        outputFormat="application/json">
        <wfs:Query typeName="${layerName}">
            ${propElements}
            <ogc:Filter>
                <ogc:Contains>
                    <ogc:PropertyName>the_geom</ogc:PropertyName>
                    <gml:Point srsName="http://www.opengis.net/gml/srs/epsg.xml#4326">
                        <gml:coordinates>${lon},${lat}</gml:coordinates>
                    </gml:Point>
                </ogc:Contains>
            </ogc:Filter>
        </wfs:Query>
    </wfs:GetFeature>`;
}
