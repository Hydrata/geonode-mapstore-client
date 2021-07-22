import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Modal, Button, Col, Grid, Row, ButtonGroup} from "react-bootstrap";
import {formatMoney} from "../../Utils/utils";
import {setVisibleBiocollectChart, setCurrentBiocollectSurveySiteId} from "../actionsBiocollect";
const {Cell, LineChart, Line, CartesianGrid, PieChart, Pie, ResponsiveContainer, XAxis, YAxis, Legend, Tooltip} = require('recharts');
import '../biocollect.css';

class BiocollectChartClass extends React.Component {
    static propTypes = {
        setVisibleBiocollectChart: PropTypes.func,
        setCurrentBiocollectSurveySiteId: PropTypes.func,
        visibleBiocollectChart: PropTypes.bool,
        currentBiocollectSurveySiteId: PropTypes.string,
        currentBiocollectSurveySite: PropTypes.object,
        swampsSurveyData: PropTypes.array,
        lineChartData: PropTypes.array
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {};
    }


    render() {
        return (
            <Modal
                show
                dialogClassName={'biocollect-modal'}
                style={{top: "60px", width: "100%", minHeight: "500px"}}
            >
                <Modal.Header>
                    <Modal.Title style={{textAlign: "center"}}>
                        <h4 style={{padding: "0", margin: "0"}}>Swamp Survey Data</h4>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Grid>
                        <Col sm={2}>
                            <Row className={'well'} style={{paddingTop: "0"}}>
                                <h4 style={{paddingTop: "5px", paddingBottom: "10px", margin: "0", textAlign: "center", fontSize: "14px"}}>Select Site</h4>
                                <ButtonGroup>
                                    {this.props.swampsSurveyData?.map((site) => {
                                        return (
                                            <Button
                                                bsStyle="info"
                                                bsSize="xsmall"
                                                block
                                                onClick={() => this.props.setCurrentBiocollectSurveySiteId(site?.properties?.site_id)}
                                                style={{
                                                    width: "150px",
                                                    marginTop: "4px",
                                                    fontSize: "x-small",
                                                    borderRadius: "3px",
                                                    overflow: "hidden"
                                                }}>
                                                {site.properties.name}
                                            </Button>
                                        );
                                    })}
                                </ButtonGroup>
                            </Row>
                            <Row className={'well'} style={{paddingTop: "20px"}}>
                                <h4 style={{paddingTop: "5px", paddingBottom: "10px", margin: "0", textAlign: "center", fontSize: "14px"}}>Sort Data By:</h4>
                                <ButtonGroup>
                                    <Button
                                        bsStyle="success"
                                        bsSize="xsmall"
                                        block>
                                        Button 1
                                    </Button>
                                    <Button
                                        bsStyle="success"
                                        bsSize="xsmall"
                                        block>
                                        Button 2
                                    </Button>
                                    <Button
                                        bsStyle="success"
                                        bsSize="xsmall"
                                        block>
                                        Button 3
                                    </Button>
                                </ButtonGroup>
                            </Row>
                        </Col>
                        <Col sm={9}>
                            <h4>{this.props.currentBiocollectSurveySite?.properties?.name}</h4>
                            <LineChart
                                width={730}
                                height={250}
                                data={this.props.lineChartData}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="measuredThingTwo" stroke="#8884d8" />
                                <Line type="monotone" dataKey="measuredThingOne" stroke="#82ca9d" />
                            </LineChart>
                            {this.props.swampsSurveyData?.map((site) => {
                                if (site.properties.site_id === this.props.currentBiocollectSurveySiteId) {
                                    return (
                                        <div>
                                            {JSON.parse(site?.properties?.activities).map((activity) => {
                                                return (
                                                    <React.Fragment>
                                                        <pre>{activity?.outputs?.[0]?.data?.dataList?.map((kv) => {
                                                            return (
                                                                <p>{kv.key}: {JSON.stringify(kv.value)}</p>
                                                            );
                                                        })}</pre>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </Col>
                    </Grid>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        bsStyle="danger"
                        bsSize="small"
                        style={{opacity: "0.7"}}
                        onClick={() => this.props.setVisibleBiocollectChart(false)}
                    >
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
const data = [
    {
        "name": "fakeData A",
        "measuredThingOne": 4000,
        "measuredThingTwo": 2400,
        "amt": 2400
    },
    {
        "name": "fakeData B",
        "measuredThingOne": 3000,
        "measuredThingTwo": 1398,
        "amt": 2210
    },
    {
        "name": "fakeData C",
        "measuredThingOne": 2000,
        "measuredThingTwo": 9800,
        "amt": 2290
    },
    {
        "name": "fakeData D",
        "measuredThingOne": 2780,
        "measuredThingTwo": 3908,
        "amt": 2000
    },
    {
        "name": "fakeData E",
        "measuredThingOne": 1890,
        "measuredThingTwo": 4800,
        "amt": 2181
    },
    {
        "name": "fakeData F",
        "measuredThingOne": 2390,
        "measuredThingTwo": 3800,
        "amt": 2500
    },
    {
        "name": "fakeData G",
        "measuredThingOne": 3490,
        "measuredThingTwo": 4300,
        "amt": 2100
    }
];

const swampData = [
    {
        "type": "Feature",
        "id": "swamps_surveysite.11",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [
                        150.32015562,
                        -33.66076033
                    ],
                    [
                        150.32097101,
                        -33.66086749
                    ],
                    [
                        150.31974792,
                        -33.66511805
                    ],
                    [
                        150.31882524,
                        -33.66501089
                    ],
                    [
                        150.31865358,
                        -33.66251059
                    ],
                    [
                        150.32015562,
                        -33.66076033
                    ]
                ]
            ]
        },
        "geometry_name": "the_geom",
        "properties": {
            "fid": 11,
            "site_id": "e7ce64a9-99dd-4009-bb94-dc8cf7d75746",
            "name": "Grand Canyon Swamp Exit Stream",
            "activities": "[{\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"locationAccuracy\", \"value\": 50}, {\"key\": \"idConfirmedBy\", \"value\": \"Other (specify in notes)\"}, {\"key\": \"taxaRichness\", \"value\": \"4\"}, {\"key\": \"surveyDate\", \"value\": \"2021-03-26T13:00:00Z\"}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"eventRemarks\", \"value\": \"This is a dummy data recording - please do not include in final results analysis.\"}, {\"key\": \"streamQualityRating\", \"value\": \"Fair\"}, {\"key\": \"observationRemarks\", \"value\": \"Sampled by university researchers\"}, {\"key\": \"taxaObservations\", \"value\": [{\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:67c46151-7449-407a-a8b3-a283ba3f0771\", \"name\": \"Scorpion flies (Mecoptera)\", \"commonName\": \"Scorpion flies\", \"scientificName\": \"Mecoptera\", \"outputSpeciesId\": \"c7e0b03a-ac3f-4559-b300-5abdc15045fd\"}, \"individualCount\": 2, \"taxonIndexValue\": 10, \"taxonWeightFactor\": 1, \"taxonSensitivityClass\": \"Very Sensitive\", \"taxonSensitivityRating\": \"10\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:4fbe14c4-2efb-4874-8842-f29e05a93f92\", \"name\": \"Stoneflies (Plecoptera)\", \"commonName\": \"Stoneflies\", \"scientificName\": \"Plecoptera\", \"outputSpeciesId\": \"9dfe11ba-60e4-4ead-81b5-596be60be6fd\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Sensitive\", \"taxonSensitivityRating\": \"10\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:928c5312-17a2-4557-b523-d207cacc332b\", \"name\": \"May flies (Ephemeroptera)\", \"commonName\": \"May flies\", \"scientificName\": \"Ephemeroptera\", \"outputSpeciesId\": \"db51ca40-0a92-40df-b928-0cd834468f69\"}, \"individualCount\": 2, \"taxonIndexValue\": 9, \"taxonWeightFactor\": 1, \"taxonSensitivityClass\": \"Very Sensitive\", \"taxonSensitivityRating\": \"9\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:1764aba8-641d-4eb8-ade5-ff33efafb054\", \"name\": \"Alder flies (Megaloptera)\", \"commonName\": \"Alder flies\", \"scientificName\": \"Megaloptera\", \"outputSpeciesId\": \"f42d28e0-3bfa-41d1-8b69-64f9e9882ef8\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Sensitive\", \"taxonSensitivityRating\": \"8\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:0964bf51-f620-4a71-9ab3-ff631f2099bb\", \"name\": \"Caddis flies (Trichoptera)\", \"commonName\": \"Caddis flies\", \"scientificName\": \"Trichoptera\", \"outputSpeciesId\": \"0435df81-4ac7-4382-ab3c-e7c74ca556ab\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Sensitive\", \"taxonSensitivityRating\": \"8\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:4b1dd080-6a02-48c4-9f6c-94680f7651dd\", \"name\": \"Horsehair worms; gordian worms (Nematomorpha)\", \"commonName\": \"Horsehair worms; gordian worms\", \"scientificName\": \"Nematomorpha\", \"outputSpeciesId\": \"cd7d5b92-9b6f-414b-81c0-0c7546ca71a9\"}, \"individualCount\": 1, \"taxonIndexValue\": 6, \"taxonWeightFactor\": 1, \"taxonSensitivityClass\": \"Sensitive\", \"taxonSensitivityRating\": \"6\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:c731c9bb-6292-4071-873d-2e8543dd120f\", \"name\": \"Mites (Acarina)\", \"commonName\": \"Mites\", \"scientificName\": \"Acarina\", \"outputSpeciesId\": \"cb192f53-d031-4349-b3c0-330fb86203ff\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Sensitive\", \"taxonSensitivityRating\": \"6\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:5b4de720-d042-47b3-824a-542b12e7c771\", \"name\": \"Cave shrimp (Anaspidacea)\", \"commonName\": \"Cave shrimp\", \"scientificName\": \"Anaspidacea\", \"outputSpeciesId\": \"150e54fe-fd39-4a78-b460-7d0e8717a4e3\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Sensitive\", \"taxonSensitivityRating\": \"6\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:db09c273-56ae-4ef9-a5ed-53027aa7c63e\", \"name\": \"Lacewings (Neuroptera)\", \"commonName\": \"Lacewings\", \"scientificName\": \"Neuroptera\", \"outputSpeciesId\": \"35f56111-fb04-490a-965d-3ea9ee3c4356\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Sensitive\", \"taxonSensitivityRating\": \"6\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:5c387616-0cb4-42f0-936e-7ec22d576939\", \"name\": \"Beetles - Riffle beetles, Whirligigs (Coleoptera)\", \"commonName\": \"Beetles - Riffle beetles, Whirligigs\", \"scientificName\": \"Coleoptera\", \"outputSpeciesId\": \"edb2385c-9570-4069-80f1-882c7fb80d6c\"}, \"individualCount\": 3, \"taxonIndexValue\": 10, \"taxonWeightFactor\": 2, \"taxonSensitivityClass\": \"Moderately Tolerant\", \"taxonSensitivityRating\": \"5\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:ed334702-b153-41b0-ac93-e6aa4964331c\", \"name\": \"Freshwater sponges (Porifera)\", \"commonName\": \"Freshwater sponges\", \"scientificName\": \"Porifera\", \"outputSpeciesId\": \"18cc6435-7ed7-4586-a8c9-0b585b98719e\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Moderately Tolerant\", \"taxonSensitivityRating\": \"4\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:a1f069f9-eaa8-487c-889a-d3cfb3dd936e\", \"name\": \"Pipe-mosses (Bryozoa)\", \"commonName\": \"Pipe-mosses\", \"scientificName\": \"Bryozoa\", \"outputSpeciesId\": \"4003390b-a623-46c1-bb6d-7c5d86eb38d4\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Moderately Tolerant\", \"taxonSensitivityRating\": \"4\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:2f12112b-d593-4392-a9db-4b026b8805a3\", \"name\": \"Yabbies; crayfish, shrimp (Decapoda)\", \"commonName\": \"Yabbies; crayfish, shrimp\", \"scientificName\": \"Decapoda\", \"outputSpeciesId\": \"bd3e0215-b25b-465f-abc1-e9f938490eb2\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Moderately Tolerant\", \"taxonSensitivityRating\": \"4\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:0a08c6cb-7990-4124-ac83-9d44274d6a84\", \"name\": \"Aquatic millipedes (Diplopoda)\", \"commonName\": \"Aquatic millipedes\", \"scientificName\": \"Diplopoda\", \"outputSpeciesId\": \"e405e51a-5a2a-4b32-badc-0cbc140fa945\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Moderately Tolerant\", \"taxonSensitivityRating\": \"4\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:89e92ab7-7ffc-4cc4-9149-19c8f8079940\", \"name\": \"Proboscis worms (Nemertea)\", \"commonName\": \"Proboscis worms\", \"scientificName\": \"Nemertea\", \"outputSpeciesId\": \"e477d064-c110-42d6-b080-d4c1a82e509c\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Moderately Tolerant\", \"taxonSensitivityRating\": \"3\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:0e7e0f7d-4456-495b-b762-2d11f78b9368\", \"name\": \"Nematodes, roundworms (Nematoda)\", \"commonName\": \"Nematodes, roundworms\", \"scientificName\": \"Nematoda\", \"outputSpeciesId\": \"b0afdbdb-251e-4e32-b118-a165f344858c\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Moderately Tolerant\", \"taxonSensitivityRating\": \"3\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:8c3070f6-9475-4b6a-95cb-8afb944ad3d5\", \"name\": \"Freshwater mussels; clams (Bivalvia)\", \"commonName\": \"Freshwater mussels; clams\", \"scientificName\": \"Bivalvia\", \"outputSpeciesId\": \"5eb34e9f-6470-4ede-9186-18e5f2dc87f4\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Moderately Tolerant\", \"taxonSensitivityRating\": \"3\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:c799e373-f43a-446d-b2d0-836e6be97b84\", \"name\": \"Side-swimmers; scuds (Amphipoda)\", \"commonName\": \"Side-swimmers; scuds\", \"scientificName\": \"Amphipoda\", \"outputSpeciesId\": \"f950afb4-65c2-4c7e-95c4-6872520dd8fd\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Moderately Tolerant\", \"taxonSensitivityRating\": \"3\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:933b2bf6-deee-4fd9-b669-4bf8cf7cc9ce\", \"name\": \"Fly larva - mosquito larvae, bloodworms (Diptera)\", \"commonName\": \"Fly larva - mosquito larvae, bloodworms\", \"scientificName\": \"Diptera\", \"outputSpeciesId\": \"e2a1b363-c009-4355-896b-0f78c9847997\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Moderately Tolerant\", \"taxonSensitivityRating\": \"3\"}, {\"taxonName\": {\"guid\": \"NZOR-4-24409\", \"name\": \"Dragonfly; damselflies (Odonata)\", \"commonName\": \"Dragonfly; damselflies\", \"scientificName\": \"Odonata\", \"outputSpeciesId\": \"01eaf704-2bb0-4e89-9190-9451723f4cb9\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Moderately Tolerant\", \"taxonSensitivityRating\": \"3\"}, {\"taxonName\": {\"guid\": \"13010000\", \"name\": \"Flatworms (Turbellaria)\", \"commonName\": \"Flatworms\", \"scientificName\": \"Turbellaria\", \"outputSpeciesId\": \"b5af4c1d-1102-4618-b426-f5d3f96a05af\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"2\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:406916d5-9058-4d72-9dbf-d3f689e8f3b2\", \"name\": \"Segmented worms (Oligochaeta)\", \"commonName\": \"Segmented worms\", \"scientificName\": \"Oligochaeta\", \"outputSpeciesId\": \"3c11c1a1-709f-4a00-ac77-ef7a7287ef4b\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"2\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:e4720a22-d642-44c7-abc6-fb5b34d5e057\", \"name\": \"Freshwater Slaters (Isopoda)\", \"commonName\": \"Freshwater Slaters\", \"scientificName\": \"Isopoda\", \"outputSpeciesId\": \"a7953f8b-3137-44a2-a03f-88aeb7b71446\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"2\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:7630fe33-a00e-4743-80da-4fa6a36cd8b2\", \"name\": \"True bugs - backswimmers, water boatman, needle bugs (Hemiptera)\", \"commonName\": \"True bugs - backswimmers, water boatman, needle bugs\", \"scientificName\": \"Hemiptera\", \"outputSpeciesId\": \"f72f0019-85ef-4215-82cf-3eea8693adfa\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"2\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:7cb6c81c-a7c4-4dd5-8578-fcfd2de847d6\", \"name\": \"Moth larvae (Lepidoptera)\", \"commonName\": \"Moth larvae\", \"scientificName\": \"Lepidoptera\", \"outputSpeciesId\": \"bfa03624-0270-4ea0-bb04-42a11bce1fd5\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"2\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:40e34a43-accb-48e3-9492-09c39ac5f756\", \"name\": \"Hydras (Hydrozoa)\", \"commonName\": \"Hydras\", \"scientificName\": \"Hydrozoa\", \"outputSpeciesId\": \"95257c70-d721-40a4-874f-11a4f695e587\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"1\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:ab81c7fc-3fc3-4e54-b277-a12a1a9cd0d8\", \"name\": \"Freshwater Snails (Gastropoda)\", \"commonName\": \"Freshwater Snails\", \"scientificName\": \"Gastropoda\", \"outputSpeciesId\": \"24ec2613-0e09-4bd4-8032-3364107e6569\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"1\"}, {\"taxonName\": {\"guid\": \"22300000\", \"name\": \"Leeches (Hirudinea)\", \"commonName\": \"Leeches\", \"scientificName\": \"Hirudinea\", \"outputSpeciesId\": \"e8d5002f-0284-4493-92df-727260cf6ecd\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"1\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:d1251470-e6f7-4f43-b97d-276dab41b06b\", \"name\": \"Bristleworms (Polychaeta)\", \"commonName\": \"Bristleworms\", \"scientificName\": \"Polychaeta\", \"outputSpeciesId\": \"3d8029c8-14b7-45cc-999c-a9ff16e97e78\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"1\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:dbc4f4ad-0ad5-4813-9275-95b00b448832\", \"name\": \"Brine shrimps; fairy shrimps (Anostraca)\", \"commonName\": \"Brine shrimps; fairy shrimps\", \"scientificName\": \"Anostraca\", \"outputSpeciesId\": \"08c6f3a5-1528-46da-af6f-94ce75d4bf35\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"1\"}, {\"taxonName\": {\"guid\": \"NZOR-4-111042\", \"name\": \"Fish lice (Branchiura)\", \"commonName\": \"Fish lice\", \"scientificName\": \"Branchiura\", \"outputSpeciesId\": \"60f31911-0fd4-43f1-8804-e748876d3313\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"1\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:925a4c2a-19fe-43c9-af4c-9b420b85b13a\", \"name\": \"Clam shrimps (Cyclestheriidae)\", \"commonName\": \"Clam shrimps\", \"scientificName\": \"Cyclestheriidae\", \"outputSpeciesId\": \"9bbdee1b-63dc-4e44-8dac-f05c3d8ca945\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"1\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:7d0c7db7-6e86-4c63-bb4c-ca80c1b84a06\", \"name\": \"Tadpole shrimp (Notostraca)\", \"commonName\": \"Tadpole shrimp\", \"scientificName\": \"Notostraca\", \"outputSpeciesId\": \"107afd11-0dea-4e02-bb59-25577be0cb5f\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"1\"}, {\"taxonName\": {\"guid\": \"urn:lsid:biodiversity.org.au:afd.taxon:53e5e456-0d08-4cff-ac1f-d453b2c07e3b\", \"name\": \"Springtails (Collembola)\", \"commonName\": \"Springtails\", \"scientificName\": \"Collembola\", \"outputSpeciesId\": \"4fc0f0df-9334-4fb1-9fee-37270ec021c8\"}, \"individualCount\": 0, \"taxonIndexValue\": \"\", \"taxonWeightFactor\": 0, \"taxonSensitivityClass\": \"Very Tolerant\", \"taxonSensitivityRating\": \"1\"}]}, {\"key\": \"spiValue\", \"value\": \"7\"}, {\"key\": \"recordedBy\", \"value\": \"Sarah Terkes\"}, {\"key\": \"surveyTime\", \"value\": \"12:12 PM\"}, {\"key\": \"surveyDuration\", \"value\": \"0.3\"}, {\"key\": \"gambusiaPresent\", \"value\": \"No\"}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.3196666343577}, {\"key\": \"habitatSampled\", \"value\": [{\"riffle\": true, \"habitatType\": \"Silt and sand\"}]}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"location\", \"value\": \"e7ce64a9-99dd-4009-bb94-dc8cf7d75746\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.662904270303585}, {\"key\": \"samplingMethod\", \"value\": [\"Sweep\"]}]}, \"name\": \"ACT Waterwatch - Water Bug Survey\"}], \"activityId\": \"56b95f49-0e04-4581-a5e3-9dc58782b344\", \"dateCreated\": \"2021-06-09\", \"description\": null}, {\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"locationAccuracy\", \"value\": null}, {\"key\": \"dipDurationInMinutes\", \"value\": \"0\"}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"eventRemarks\", \"value\": \"There is no piezometer at the exit stream so we just record the water physics here.\"}, {\"key\": \"recordedBy\", \"value\": \"Sarah Terkes\"}, {\"key\": \"piezometerId\", \"value\": \"GCp2\"}, {\"key\": \"totalWaterDepthInCentimetres\", \"value\": \"0\"}, {\"key\": \"waterTableHeightInCentimetres\", \"value\": \"0\"}, {\"key\": \"waterMeasurementsRepeatSection\", \"value\": [{\"waterPh\": \"6.63\", \"waterTemperatureInDegreesCelcius\": \"13.7\", \"waterDissolvedOxygenInPercentSaturation\": \"92.6\", \"waterDissolvedOxygenInMilligramsPerLitre\": \"9.61\", \"waterElectricalConductivityInMicrosiemensPerCentimetre\": \"23.39\"}, {\"waterPh\": \"6.62\", \"waterTemperatureInDegreesCelcius\": \"13.7\", \"waterDissolvedOxygenInPercentSaturation\": \"92.6\", \"waterDissolvedOxygenInMilligramsPerLitre\": \"9.61\", \"waterElectricalConductivityInMicrosiemensPerCentimetre\": \"23.41\"}, {\"waterPh\": \"6.62\", \"waterTemperatureInDegreesCelcius\": \"13.7\", \"waterDissolvedOxygenInPercentSaturation\": \"9.61\", \"waterDissolvedOxygenInMilligramsPerLitre\": \"9.61\", \"waterElectricalConductivityInMicrosiemensPerCentimetre\": \"23.45\"}, {\"waterPh\": \"6.62\", \"waterTemperatureInDegreesCelcius\": \"13.7\", \"waterDissolvedOxygenInPercentSaturation\": \"92.6\", \"waterDissolvedOxygenInMilligramsPerLitre\": \"9.61\", \"waterElectricalConductivityInMicrosiemensPerCentimetre\": \"23.42\"}, {\"waterPh\": \"6.62\", \"waterTemperatureInDegreesCelcius\": \"13.7\", \"waterDissolvedOxygenInPercentSaturation\": \"92.6\", \"waterDissolvedOxygenInMilligramsPerLitre\": \"9.61\", \"waterElectricalConductivityInMicrosiemensPerCentimetre\": \"23.37\"}]}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.3196666343577}, {\"key\": \"eventTime\", \"value\": \"01:10 PM\"}, {\"key\": \"piezometerHeightAboveGroundInCentimetres\", \"value\": \"0\"}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"location\", \"value\": \"e7ce64a9-99dd-4009-bb94-dc8cf7d75746\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.662904270303585}, {\"key\": \"relativeWaterLevelDifferenceInCentimetres\", \"value\": 0}, {\"key\": \"eventDate\", \"value\": \"2021-03-26T13:00:00Z\"}]}, \"name\": \"BMWHI - Piezometer Readings\"}], \"activityId\": \"dde120bc-11be-437b-984c-48644c78552f\", \"dateCreated\": \"2021-06-09\", \"description\": null}, {\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"eventRemarks\", \"value\": \"No Piezometer at exit stream\"}, {\"key\": \"waterTemperatureInDegreesCelcius_1\", \"value\": \"13.7\"}, {\"key\": \"waterTemperatureInDegreesCelcius_3\", \"value\": \"13.7\"}, {\"key\": \"waterTemperatureInDegreesCelcius_2\", \"value\": \"13.7\"}, {\"key\": \"waterTemperatureInDegreesCelcius_5\", \"value\": \"13.7\"}, {\"key\": \"waterTemperatureInDegreesCelcius_4\", \"value\": \"13.7\"}, {\"key\": \"piezometerId\", \"value\": \"\"}, {\"key\": \"totalWaterDepthInCentimetres\", \"value\": \"0\"}, {\"key\": \"waterElectricalConductivityInMicrosiemensPerCentimetre_5\", \"value\": \"23.37\"}, {\"key\": \"waterTableHeightInCentimetres\", \"value\": \"0\"}, {\"key\": \"eventTime\", \"value\": \"12:30 PM\"}, {\"key\": \"waterPh_2\", \"value\": \"6.62\"}, {\"key\": \"waterDissolvedOxygenInPercentSaturation_2\", \"value\": \"92.6\"}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"waterPh_3\", \"value\": \"6.62\"}, {\"key\": \"waterDissolvedOxygenInPercentSaturation_1\", \"value\": \"92.6\"}, {\"key\": \"waterDissolvedOxygenInPercentSaturation_4\", \"value\": \"92.6\"}, {\"key\": \"relativeWaterLevelDifferenceInCentimetres\", \"value\": 0}, {\"key\": \"waterPh_1\", \"value\": \"6.63\"}, {\"key\": \"waterDissolvedOxygenInPercentSaturation_3\", \"value\": \"92.6\"}, {\"key\": \"waterElectricalConductivityInMicrosiemensPerCentimetre_4\", \"value\": \"23.42\"}, {\"key\": \"waterElectricalConductivityInMicrosiemensPerCentimetre_3\", \"value\": \"23.45\"}, {\"key\": \"waterDissolvedOxygenInPercentSaturation_5\", \"value\": \"92.6\"}, {\"key\": \"waterPh_4\", \"value\": \"6.62\"}, {\"key\": \"waterElectricalConductivityInMicrosiemensPerCentimetre_2\", \"value\": \"23.41\"}, {\"key\": \"waterPh_5\", \"value\": \"6.62\"}, {\"key\": \"waterElectricalConductivityInMicrosiemensPerCentimetre_1\", \"value\": \"23.39\"}, {\"key\": \"locationAccuracy\", \"value\": null}, {\"key\": \"dipDurationInMinutes\", \"value\": \"0\"}, {\"key\": \"waterDissolvedOxygenInMilligramsPerLitre_4\", \"value\": \"9.61\"}, {\"key\": \"waterDissolvedOxygenInMilligramsPerLitre_5\", \"value\": \"9.61\"}, {\"key\": \"waterDissolvedOxygenInMilligramsPerLitre_2\", \"value\": \"9.61\"}, {\"key\": \"waterDissolvedOxygenInMilligramsPerLitre_3\", \"value\": \"9.61\"}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"recordedBy\", \"value\": \"Sarah Terkes\"}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.3196666343577}, {\"key\": \"piezometerHeightAboveGroundInCentimetres\", \"value\": \"0\"}, {\"key\": \"waterDissolvedOxygenInMilligramsPerLitre_1\", \"value\": \"9.61\"}, {\"key\": \"location\", \"value\": \"e7ce64a9-99dd-4009-bb94-dc8cf7d75746\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.662904270303585}, {\"key\": \"eventDate\", \"value\": \"2021-03-26T13:00:00Z\"}]}, \"name\": \"BMWHI - Piezometer Readings\"}], \"activityId\": \"909f6152-da08-4bf5-8a0d-abe223a2f0c4\", \"dateCreated\": \"2021-06-11\", \"description\": null}, {\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"locationAccuracy\", \"value\": null}, {\"key\": \"sampleId\", \"value\": \"GCP2 March 2021\"}, {\"key\": \"sampleAnalysisDate\", \"value\": \"2021-03-29T13:00:00Z\"}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"eventRemarks\", \"value\": \"Data was collected and analysed by Dr Ian Wright, and input into BioCollect by Sarah Terkes. There is no piezometer at this location - this is an exit stream.\"}, {\"key\": \"samplePreparationDate\", \"value\": \"2021-03-29T13:00:00Z\"}, {\"key\": \"recordedBy\", \"value\": \"Sarah Terkes\"}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.3196666343577}, {\"key\": \"waterChemistryProperties\", \"value\": [{\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Calcium (mg/L)\", \"measurementMethod\": \"Metals-020\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Potassium (mg/L)\", \"measurementMethod\": \"Metals-020\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"3.1\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Sodium (mg/L)\", \"measurementMethod\": \"Metals-020\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Magnesium (mg/L)\", \"measurementMethod\": \"Metals-020\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"3\", \"measurementPql\": \"3\", \"measuredProperty\": \"Hardness (mgCaCo3/L)\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Hydroxide Alkalinity (OH-) (mg/L)\", \"measurementMethod\": \"Inorg-006\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Bicarbonate Alkalinity (mg/L)\", \"measurementMethod\": \"Inorg-006\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Carbonate Alkalinity (mg/L)\", \"measurementMethod\": \"Inorg-006\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Total Alkalinity as CaCo3 (mg/L)\", \"measurementMethod\": \"Inorg-006\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Sulphate (SO4) (mg/L)\", \"measurementMethod\": \"Inorg-081\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"3\", \"measurementPql\": \"1\", \"measuredProperty\": \"Chloride (Cl) (mg/L)\", \"measurementMethod\": \"Inorg-081\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"6\", \"measurementPql\": \"0\", \"measuredProperty\": \"Ionic Balance (%)\", \"measurementMethod\": \"Inorg-040\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Arsenic - Total (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"20\", \"measurementPql\": \"20\", \"measuredProperty\": \"Boron - Total (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"2\", \"measurementPql\": \"1\", \"measuredProperty\": \"Barium (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Beryllium - Total (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Cobalt - Total (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Copper (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"220\", \"measurementPql\": \"10\", \"measuredProperty\": \"Aluminium (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"180\", \"measurementPql\": \"10\", \"measuredProperty\": \"Iron - Total (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Manganese (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Lead (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Nickel (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"3\", \"measurementPql\": \"1\", \"measuredProperty\": \"Zinc (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Strontium (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Lithium (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Chromium (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}]}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"location\", \"value\": \"e7ce64a9-99dd-4009-bb94-dc8cf7d75746\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.662904270303585}, {\"key\": \"eventDate\", \"value\": \"2021-03-26T13:00:00Z\"}]}, \"name\": \"BMWHI - Water Chemical Properties\"}], \"activityId\": \"9b1e6edd-dacc-4e54-9afb-75e6ad0ce8ee\", \"dateCreated\": \"2021-06-09\", \"description\": null}, {\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"recentFireHistoryBoolean\", \"value\": \"No\"}, {\"key\": \"locationDescription\", \"value\": \"Please note this is a dummy data recording - do not include in final results analysis\"}, {\"key\": \"locationPhotoDirection\", \"value\": \"North\"}, {\"key\": \"contactAgreement\", \"value\": \"No\"}, {\"key\": \"observationDate\", \"value\": \"2021-03-26T13:00:00Z\"}, {\"key\": \"treeSpecies\", \"value\": {\"guid\": \"https://id.biodiversity.org.au/taxon/apni/51302291\", \"name\": \"Eucalyptus\", \"listId\": \"\", \"commonName\": null, \"scientificName\": \"Eucalyptus\", \"outputSpeciesId\": \"494cb998-db3a-4575-ba1c-87cb8aff7e12\"}}, {\"key\": \"landuse\", \"value\": \"Native vegetation\"}, {\"key\": \"scorchHeightAboveGroundInMetres\", \"value\": \"0\"}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"simplePhotoProtocolCanopy\", \"value\": []}, {\"key\": \"locationAccuracy\", \"value\": 50}, {\"key\": \"severityClass\", \"value\": \"Unburnt\"}, {\"key\": \"simplePhotoProtocolSky\", \"value\": []}, {\"key\": \"vegetationStructuretable\", \"value\": [{\"vegetationLayerTrees\": \"0\", \"vegetationLayerGround\": \"0\", \"vegetationLayerShrubs\": \"0\", \"percentOfFireImpactClass\": \"Height of layer (m)\", \"vegetationLayerSubCanopy\": \"0\"}, {\"vegetationLayerTrees\": \"0\", \"vegetationLayerGround\": \"0\", \"vegetationLayerShrubs\": \"0\", \"percentOfFireImpactClass\": \"% Cover of living vegetation\", \"vegetationLayerSubCanopy\": \"0\"}, {\"vegetationLayerTrees\": \"0\", \"vegetationLayerGround\": \"0\", \"vegetationLayerShrubs\": \"0\", \"percentOfFireImpactClass\": \"% Cover of vegetation scorched (brown) but not fully consumed by fire\", \"vegetationLayerSubCanopy\": \"0\"}, {\"vegetationLayerTrees\": \"0\", \"vegetationLayerGround\": \"0\", \"vegetationLayerShrubs\": \"0\", \"percentOfFireImpactClass\": \"% Cover of vegetation that would have been fully consumed by fire\", \"vegetationLayerSubCanopy\": \"0\"}]}, {\"key\": \"vegetationStructuralType\", \"value\": \"Dry Sclerophyll\"}, {\"key\": \"topography\", \"value\": \"Ridge\"}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"locationPhoto\", \"value\": [{\"name\": \"165112210_2854505828209118_8324485622534677359_n.jpg\", \"role\": \"surveyImage\", \"type\": \"image\", \"notes\": \"\", \"status\": \"active\", \"licence\": \"CC BY 3.0\", \"filename\": \"165112210_2854505828209118_8324485622534677359_n.jpg\", \"filepath\": \"2021-06\", \"filesize\": 533833, \"outputId\": \"1601aa91-2e38-4080-a519-da18ead87143\", \"dateTaken\": \"2021-06-09T04:15:08Z\", \"activityId\": \"453821ed-74ff-421f-b031-e4fa35685367\", \"documentId\": \"da9c2f59-35d6-42a9-b03f-c8f07c5f2afb\", \"identifier\": \"https://biocollect.ala.org.au/image?id=165112210_2854505828209118_8324485622534677359_n.jpg\", \"attribution\": \"\", \"contentType\": \"image/jpeg\", \"formattedSize\": \"533.83 KB\"}]}, {\"key\": \"simplePhotoProtocolSouth\", \"value\": []}, {\"key\": \"recordedBy\", \"value\": \"Sarah Terkes\"}, {\"key\": \"foliageProjectedCoverEstimateCategorical\", \"value\": \"Low Cover <30%\"}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.3196666343577}, {\"key\": \"location\", \"value\": \"e7ce64a9-99dd-4009-bb94-dc8cf7d75746\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.662904270303585}, {\"key\": \"simplePhotoProtocolNorth\", \"value\": []}, {\"key\": \"simplePhotoProtocolGround\", \"value\": []}]}, \"name\": \"Bush After Fire\"}], \"activityId\": \"453821ed-74ff-421f-b031-e4fa35685367\", \"dateCreated\": \"2021-06-09\", \"description\": null}]"
        }
    },
    {
        "type": "Feature",
        "id": "swamps_surveysite.12",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [
                        150.20166166,
                        -33.74121321
                    ],
                    [
                        150.20264871,
                        -33.73867943
                    ],
                    [
                        150.20449407,
                        -33.73643109
                    ],
                    [
                        150.20900019,
                        -33.73707348
                    ],
                    [
                        150.20698316,
                        -33.738501
                    ],
                    [
                        150.20535238,
                        -33.74085635
                    ],
                    [
                        150.20591028,
                        -33.74249791
                    ],
                    [
                        150.20290621,
                        -33.74264066
                    ],
                    [
                        150.20157583,
                        -33.74246223
                    ],
                    [
                        150.20166166,
                        -33.74121321
                    ]
                ]
            ]
        },
        "geometry_name": "the_geom",
        "properties": {
            "fid": 12,
            "site_id": "89030c0b-d965-428c-8bf0-ab165e74bf2e",
            "name": "Private site for survey: Water table monitoring - piezometer recordings",
            "activities": "[]"
        }
    },
    {
        "type": "Feature",
        "id": "swamps_surveysite.13",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [
                        150.32114267,
                        -33.66441797
                    ],
                    [
                        150.31964064,
                        -33.66540022
                    ],
                    [
                        150.31857848,
                        -33.66493588
                    ],
                    [
                        150.31943679,
                        -33.66214982
                    ],
                    [
                        150.32015562,
                        -33.66219447
                    ],
                    [
                        150.31997323,
                        -33.66400721
                    ],
                    [
                        150.32114267,
                        -33.66441797
                    ]
                ]
            ]
        },
        "geometry_name": "the_geom",
        "properties": {
            "fid": 13,
            "site_id": "b1c4f414-edd1-4c51-9c99-8c3149c5ead1",
            "name": "Grand Canyon Swamp Piezometer",
            "activities": "[{\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"locationAccuracy\", \"value\": null}, {\"key\": \"waterDissolvedOxygenInMilligramsPerLitre\", \"value\": \"6.82\"}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"locationSource\", \"value\": \"Google maps\"}, {\"key\": \"waterDissolvedOxygenInPercentSaturation\", \"value\": \"68\"}, {\"key\": \"recordedBy\", \"value\": \"Dr Ian Wright\"}, {\"key\": \"piezometerId\", \"value\": \"GCP1\"}, {\"key\": \"waterPh\", \"value\": \"6\"}, {\"key\": \"waterTemperatureInDegreesCelcius\", \"value\": \"15.3\"}, {\"key\": \"waterTableHeightInCentimetres\", \"value\": \"0\"}, {\"key\": \"waterElectricalConductivityInMicrosiemensPerCentimetre\", \"value\": \"25.8\"}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.31964272901396}, {\"key\": \"eventTime\", \"value\": \"11:00 AM\"}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"location\", \"value\": \"b1c4f414-edd1-4c51-9c99-8c3149c5ead1\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.66397758593848}, {\"key\": \"dipDuration\", \"value\": \"3\"}, {\"key\": \"eventDate\", \"value\": \"2021-03-26T13:00:00Z\"}]}, \"name\": \"BMWHI - Piezometer Readings\"}], \"activityId\": \"a07efb42-6b1d-4e91-8d98-c09b36a9c961\", \"dateCreated\": \"2021-05-20\", \"description\": null}, {\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"locationAccuracy\", \"value\": null}, {\"key\": \"dipDurationInMinutes\", \"value\": \"3\"}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"eventRemarks\", \"value\": \"Readings were taken by Dr Ian Wright and recorded / uploaded to BioCollect by Sarah Terkes\"}, {\"key\": \"recordedBy\", \"value\": \"Sarah Terkes\"}, {\"key\": \"piezometerId\", \"value\": \"GCP1\"}, {\"key\": \"totalWaterDepthInCentimetres\", \"value\": \"216\"}, {\"key\": \"waterTableHeightInCentimetres\", \"value\": \"31\"}, {\"key\": \"waterMeasurementsRepeatSection\", \"value\": [{\"waterPh\": \"5.55\", \"waterTemperatureInDegreesCelcius\": \"15.6\", \"waterDissolvedOxygenInPercentSaturation\": \"68.9\", \"waterDissolvedOxygenInMilligramsPerLitre\": \"6.91\", \"waterElectricalConductivityInMicrosiemensPerCentimetre\": \"25.8\"}, {\"waterPh\": \"5.56\", \"waterTemperatureInDegreesCelcius\": \"15.3\", \"waterDissolvedOxygenInPercentSaturation\": \"68.6\", \"waterDissolvedOxygenInMilligramsPerLitre\": \"6.86\", \"waterElectricalConductivityInMicrosiemensPerCentimetre\": \"25.8\"}, {\"waterPh\": \"5.57\", \"waterTemperatureInDegreesCelcius\": \"15.2\", \"waterDissolvedOxygenInPercentSaturation\": \"68\", \"waterDissolvedOxygenInMilligramsPerLitre\": \"6.81\", \"waterElectricalConductivityInMicrosiemensPerCentimetre\": \"25.8\"}, {\"waterPh\": \"5.57\", \"waterTemperatureInDegreesCelcius\": \"15.3\", \"waterDissolvedOxygenInPercentSaturation\": \"68\", \"waterDissolvedOxygenInMilligramsPerLitre\": \"6.81\", \"waterElectricalConductivityInMicrosiemensPerCentimetre\": \"25.8\"}, {\"waterPh\": \"5.57\", \"waterTemperatureInDegreesCelcius\": \"15.3\", \"waterDissolvedOxygenInPercentSaturation\": \"67.9\", \"waterDissolvedOxygenInMilligramsPerLitre\": \"6.8\", \"waterElectricalConductivityInMicrosiemensPerCentimetre\": \"25.8\"}]}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.31964272901396}, {\"key\": \"eventTime\", \"value\": \"11:00 AM\"}, {\"key\": \"piezometerHeightAboveGroundInCentimetres\", \"value\": \"41\"}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"location\", \"value\": \"b1c4f414-edd1-4c51-9c99-8c3149c5ead1\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.66397758593848}, {\"key\": \"relativeWaterLevelDifferenceInCentimetres\", \"value\": 10}, {\"key\": \"eventDate\", \"value\": \"2021-03-26T13:00:00Z\"}]}, \"name\": \"BMWHI - Piezometer Readings\"}], \"activityId\": \"9042ff95-dd10-4c21-8661-5af072380813\", \"dateCreated\": \"2021-06-09\", \"description\": null}, {\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"eventRemarks\", \"value\": \"Data was recorded by Dr Ian Wright and Sarah Terkes\"}, {\"key\": \"waterTemperatureInDegreesCelcius_1\", \"value\": \"15.6\"}, {\"key\": \"waterTemperatureInDegreesCelcius_3\", \"value\": \"15.2\"}, {\"key\": \"waterTemperatureInDegreesCelcius_2\", \"value\": \"15.3\"}, {\"key\": \"waterTemperatureInDegreesCelcius_5\", \"value\": \"15.3\"}, {\"key\": \"waterTemperatureInDegreesCelcius_4\", \"value\": \"15.3\"}, {\"key\": \"piezometerId\", \"value\": \"GCP1\"}, {\"key\": \"totalWaterDepthInCentimetres\", \"value\": \"216\"}, {\"key\": \"waterElectricalConductivityInMicrosiemensPerCentimetre_5\", \"value\": \"25.8\"}, {\"key\": \"waterTableHeightInCentimetres\", \"value\": \"31\"}, {\"key\": \"eventTime\", \"value\": \"11:00 AM\"}, {\"key\": \"waterPh_2\", \"value\": \"5.56\"}, {\"key\": \"waterDissolvedOxygenInPercentSaturation_2\", \"value\": \"68.6\"}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"waterPh_3\", \"value\": \"5.57\"}, {\"key\": \"waterDissolvedOxygenInPercentSaturation_1\", \"value\": \"68.9\"}, {\"key\": \"waterDissolvedOxygenInPercentSaturation_4\", \"value\": \"68\"}, {\"key\": \"relativeWaterLevelDifferenceInCentimetres\", \"value\": 10}, {\"key\": \"waterPh_1\", \"value\": \"5.55\"}, {\"key\": \"waterDissolvedOxygenInPercentSaturation_3\", \"value\": \"68\"}, {\"key\": \"waterElectricalConductivityInMicrosiemensPerCentimetre_4\", \"value\": \"25.8\"}, {\"key\": \"waterElectricalConductivityInMicrosiemensPerCentimetre_3\", \"value\": \"25.8\"}, {\"key\": \"waterDissolvedOxygenInPercentSaturation_5\", \"value\": \"67.9\"}, {\"key\": \"waterPh_4\", \"value\": \"5.57\"}, {\"key\": \"waterElectricalConductivityInMicrosiemensPerCentimetre_2\", \"value\": \"25.8\"}, {\"key\": \"waterPh_5\", \"value\": \"5.57\"}, {\"key\": \"waterElectricalConductivityInMicrosiemensPerCentimetre_1\", \"value\": \"25.8\"}, {\"key\": \"locationAccuracy\", \"value\": null}, {\"key\": \"dipDurationInMinutes\", \"value\": \"3\"}, {\"key\": \"waterDissolvedOxygenInMilligramsPerLitre_4\", \"value\": \"6.81\"}, {\"key\": \"waterDissolvedOxygenInMilligramsPerLitre_5\", \"value\": \"6.8\"}, {\"key\": \"waterDissolvedOxygenInMilligramsPerLitre_2\", \"value\": \"6.86\"}, {\"key\": \"waterDissolvedOxygenInMilligramsPerLitre_3\", \"value\": \"6.81\"}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"recordedBy\", \"value\": \"Sarah Terkes\"}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.31964272901396}, {\"key\": \"piezometerHeightAboveGroundInCentimetres\", \"value\": \"41\"}, {\"key\": \"waterDissolvedOxygenInMilligramsPerLitre_1\", \"value\": \"6.91\"}, {\"key\": \"location\", \"value\": \"b1c4f414-edd1-4c51-9c99-8c3149c5ead1\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.66397758593848}, {\"key\": \"eventDate\", \"value\": \"2021-06-11T13:51:39+1000\"}]}, \"name\": \"BMWHI - Piezometer Readings\"}], \"activityId\": \"532235bb-36c6-4155-98ed-73ae893fa2d7\", \"dateCreated\": \"2021-06-11\", \"description\": null}, {\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"locationAccuracy\", \"value\": null}, {\"key\": \"recordedBy\", \"value\": \"Dr Ian Wright\"}, {\"key\": \"sampleId\", \"value\": \"GCP1 270321\"}, {\"key\": \"sampleAnalysisDate\", \"value\": \"2021-03-29T13:00:00Z\"}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.31964272901396}, {\"key\": \"waterChemistryProperties\", \"value\": [{\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Calcium (mg/L)\", \"measurementMethod\": \"Metals-020\"}, {\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Potassium (mg/L)\", \"measurementMethod\": \"Metals-020\"}, {\"measuredValue\": \"3.1\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Sodium (mg/L)\", \"measurementMethod\": \"Metals-020\"}, {\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Magnesium (mg/L)\", \"measurementMethod\": \"Metals-020\"}, {\"measuredValue\": \"3\", \"measurementPql\": \"3\", \"measuredProperty\": \"Hardness (mgCaCo3/L)\", \"measurementMethod\": \"Inorg-006\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Hydroxide Alkalinity (OH-) (mg/L)\", \"measurementMethod\": \"Inorg-006\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Bicarbonate Alkalinity (mg/L)\", \"measurementMethod\": \"Inorg-006\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Carbonate Alkalinity (mg/L)\", \"measurementMethod\": \"Inorg-006\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Total Alkalinity as CaCo3 (mg/L)\", \"measurementMethod\": \"Inorg-006\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Sulphate (SO4) (mg/L)\", \"measurementMethod\": \"Inorg-081\"}, {\"measuredValue\": \"3\", \"measurementPql\": \"1\", \"measuredProperty\": \"Chloride (Cl) (mg/L)\", \"measurementMethod\": \"Inorg-081\"}, {\"measuredValue\": \"4\", \"measurementPql\": \"0\", \"measuredProperty\": \"Ionic Balance (%)\", \"measurementMethod\": \"Inorg-040\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Arsenic - Total (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"20\", \"measurementPql\": \"20\", \"measuredProperty\": \"Boron - Total (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"4\", \"measurementPql\": \"1\", \"measuredProperty\": \"Barium (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Beryllium - Total (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Cobalt - Total (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"12\", \"measurementPql\": \"1\", \"measuredProperty\": \"Copper (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"830\", \"measurementPql\": \"10\", \"measuredProperty\": \"Aluminium (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"3600\", \"measurementPql\": \"10\", \"measuredProperty\": \"Iron - Total (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"11\", \"measurementPql\": \"5\", \"measuredProperty\": \"Manganese (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Lead (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Nickel (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"13\", \"measurementPql\": \"1\", \"measuredProperty\": \"Zinc (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"1.8\", \"measurementPql\": \"1\", \"measuredProperty\": \"Strontium (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Lithium (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Chromium (µg/L)\", \"measurementMethod\": \"need relevant methods to be specified for this\"}]}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"location\", \"value\": \"b1c4f414-edd1-4c51-9c99-8c3149c5ead1\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.66397758593848}, {\"key\": \"samplePreparationDate\", \"value\": \"2021-03-29T13:00:00Z\"}, {\"key\": \"eventDate\", \"value\": \"2021-03-26T13:00:00Z\"}]}, \"name\": \"BMWHI - Water Chemical Properties\"}], \"activityId\": \"54e93461-2ed1-4ab1-88e1-7d2bf42303d9\", \"dateCreated\": \"2021-05-20\", \"description\": null}, {\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"locationAccuracy\", \"value\": null}, {\"key\": \"sampleId\", \"value\": \"GCP1 March 2021\"}, {\"key\": \"sampleAnalysisDate\", \"value\": \"2021-03-29T13:00:00Z\"}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"eventRemarks\", \"value\": \"Data was collected and analysed by Dr Ian Wright of Western Sydney University. Data was input to BioCollect by Sarah Terkes.\"}, {\"key\": \"samplePreparationDate\", \"value\": \"2021-03-29T13:00:00Z\"}, {\"key\": \"recordedBy\", \"value\": \"Sarah Terkes\"}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.31964272901396}, {\"key\": \"waterChemistryProperties\", \"value\": [{\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Calcium (mg/L)\", \"measurementMethod\": \"Metals-020\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Potassium (mg/L)\", \"measurementMethod\": \"Metals-020\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"3.1\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Sodium (mg/L)\", \"measurementMethod\": \"Metals-020\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Magnesium (mg/L)\", \"measurementMethod\": \"Metals-020\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"3\", \"measurementPql\": \"3\", \"measuredProperty\": \"Hardness (mgCaCo3/L)\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Hydroxide Alkalinity (OH-) (mg/L)\", \"measurementMethod\": \"Inorg-006\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Bicarbonate Alkalinity (mg/L)\", \"measurementMethod\": \"Inorg-006\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Carbonate Alkalinity (mg/L)\", \"measurementMethod\": \"Inorg-006\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"5\", \"measurementPql\": \"5\", \"measuredProperty\": \"Total Alkalinity as CaCo3 (mg/L)\", \"measurementMethod\": \"Inorg-006\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Sulphate (SO4) (mg/L)\", \"measurementMethod\": \"Inorg-081\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"3\", \"measurementPql\": \"1\", \"measuredProperty\": \"Chloride (Cl) (mg/L)\", \"measurementMethod\": \"Inorg-081\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"4\", \"measurementPql\": \"0\", \"measuredProperty\": \"Ionic Balance (%)\", \"measurementMethod\": \"Inorg-040\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Arsenic - Total (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"20\", \"measurementPql\": \"20\", \"measuredProperty\": \"Boron - Total (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"4\", \"measurementPql\": \"1\", \"measuredProperty\": \"Barium (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"0.5\", \"measurementPql\": \"0.5\", \"measuredProperty\": \"Beryllium - Total (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Cobalt - Total (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"12\", \"measurementPql\": \"1\", \"measuredProperty\": \"Copper (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"830\", \"measurementPql\": \"10\", \"measuredProperty\": \"Aluminium (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"3600\", \"measurementPql\": \"10\", \"measuredProperty\": \"Iron - Total (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"11\", \"measurementPql\": \"5\", \"measuredProperty\": \"Manganese (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Lead (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Nickel (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"13\", \"measurementPql\": \"1\", \"measuredProperty\": \"Zinc (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"1.8\", \"measurementPql\": \"1\", \"measuredProperty\": \"Strontium (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"=\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Lithium (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}, {\"measuredValue\": \"1\", \"measurementPql\": \"1\", \"measuredProperty\": \"Chromium (µg/L)\", \"measurementMethod\": \"Metals-022\", \"measuredValueQualifier\": \"<\"}]}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"location\", \"value\": \"b1c4f414-edd1-4c51-9c99-8c3149c5ead1\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.66397758593848}, {\"key\": \"eventDate\", \"value\": \"2021-03-26T13:00:00Z\"}]}, \"name\": \"BMWHI - Water Chemical Properties\"}], \"activityId\": \"8bc2f712-d694-43db-8af0-6520f1db29d4\", \"dateCreated\": \"2021-06-09\", \"description\": null}, {\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"locationAccuracy\", \"value\": null}, {\"key\": \"contemporarySandLayerPresent\", \"value\": \"Yes\"}, {\"key\": \"corePhoto\", \"value\": [{\"name\": \"IMG_2557.JPG\", \"role\": \"surveyImage\", \"type\": \"image\", \"notes\": \"\", \"status\": \"active\", \"licence\": \"CC BY 3.0\", \"filename\": \"processed_IMG_2557.JPG\", \"filepath\": \"2021-05\", \"filesize\": 7974022, \"outputId\": \"b2701293-aeda-4f74-9b65-58f189e937b4\", \"dateTaken\": \"2021-03-26T23:48:15Z\", \"activityId\": \"78975aae-4d45-4269-9d90-d084f451888b\", \"documentId\": \"84951dda-d930-4e42-a7b8-5a49b5909e9e\", \"identifier\": \"https://biocollect.ala.org.au/image?id=IMG_2557.JPG\", \"attribution\": \"\", \"contentType\": \"image/jpeg\", \"formattedSize\": \"7.97 MB\"}]}, {\"key\": \"clayStackDepthInCentimetres\", \"value\": \"20\"}, {\"key\": \"clayStackPhoto\", \"value\": []}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"sedimentSubSampleRepeatSection\", \"value\": []}, {\"key\": \"peatStackDepthInCentimetres\", \"value\": \"13\"}, {\"key\": \"recordedBy\", \"value\": \"Sarah Terkes\"}, {\"key\": \"peatStackPhoto\", \"value\": []}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.31964272901396}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"location\", \"value\": \"b1c4f414-edd1-4c51-9c99-8c3149c5ead1\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.66397758593848}, {\"key\": \"coreId\", \"value\": \"GCP1 270321\"}, {\"key\": \"alternatingOrganicSandLayerThicknessInCentimetres\", \"value\": \"0\"}, {\"key\": \"eventDate\", \"value\": \"2021-03-26T13:00:00Z\"}]}, \"name\": \"BMWHI - Wetland Sediment Survey\"}], \"activityId\": \"78975aae-4d45-4269-9d90-d084f451888b\", \"dateCreated\": \"2021-05-20\", \"description\": null}, {\"outputs\": [{\"data\": {\"dataList\": [{\"key\": \"locationAccuracy\", \"value\": null}, {\"key\": \"contemporarySandLayerPresent\", \"value\": \"No\"}, {\"key\": \"corePhoto\", \"value\": [{\"name\": \"IMG_2557_(1).JPG\", \"role\": \"surveyImage\", \"type\": \"image\", \"notes\": \"\", \"status\": \"active\", \"licence\": \"CC BY 3.0\", \"filename\": \"processed_IMG_2557_(1).JPG\", \"filepath\": \"2021-06\", \"filesize\": 7974022, \"outputId\": \"a2e062e2-cbeb-4e59-be31-618f9f2c4e49\", \"dateTaken\": \"2021-03-26T23:48:15Z\", \"activityId\": \"930c54f8-4dbf-4169-a417-c129c054dbf8\", \"documentId\": \"1501d72d-c008-4253-9af2-c1ef140be6e4\", \"identifier\": \"https://biocollect.ala.org.au/image?id=IMG_2557_%281%29.JPG\", \"attribution\": \"\", \"contentType\": \"image/jpeg\", \"formattedSize\": \"7.97 MB\"}]}, {\"key\": \"clayStackDepthInCentimetres\", \"value\": \"20\"}, {\"key\": \"locationLatitude\", \"value\": null}, {\"key\": \"sedimentSubSampleRepeatSection\", \"value\": []}, {\"key\": \"peatStackDepthInCentimetres\", \"value\": \"13\"}, {\"key\": \"recordedBy\", \"value\": \"Sarah Terkes\"}, {\"key\": \"locationCentroidLongitude\", \"value\": 150.31964272901396}, {\"key\": \"locationLongitude\", \"value\": null}, {\"key\": \"location\", \"value\": \"b1c4f414-edd1-4c51-9c99-8c3149c5ead1\"}, {\"key\": \"locationCentroidLatitude\", \"value\": -33.66397758593848}, {\"key\": \"coreId\", \"value\": \"GCP1 MARCH 2021\"}, {\"key\": \"alternatingOrganicSandLayerThicknessInCentimetres\", \"value\": \"0\"}, {\"key\": \"eventDate\", \"value\": \"2021-03-26T13:00:00Z\"}]}, \"name\": \"BMWHI - Wetland Sediment Survey\"}], \"activityId\": \"930c54f8-4dbf-4169-a417-c129c054dbf8\", \"dateCreated\": \"2021-06-09\", \"description\": null}]"
        }
    },
    {
        "type": "Feature",
        "id": "swamps_surveysite.14",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [
                        150.42689681,
                        -33.71496783
                    ],
                    [
                        150.42764783,
                        -33.71527125
                    ],
                    [
                        150.42726159,
                        -33.7172435
                    ],
                    [
                        150.42623162,
                        -33.71696686
                    ],
                    [
                        150.42689681,
                        -33.71496783
                    ]
                ]
            ]
        },
        "geometry_name": "the_geom",
        "properties": {
            "fid": 14,
            "site_id": "a2f70dd0-cbf6-4385-876d-d929baed584f",
            "name": "Lawson Swamp Piezometer",
            "activities": "[]"
        }
    },
    {
        "type": "Feature",
        "id": "swamps_surveysite.15",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [
                        150.42691827,
                        -33.71498568
                    ],
                    [
                        150.42765856,
                        -33.71524448
                    ],
                    [
                        150.42720795,
                        -33.71733275
                    ],
                    [
                        150.42621017,
                        -33.71720781
                    ],
                    [
                        150.42658567,
                        -33.71592273
                    ],
                    [
                        150.42691827,
                        -33.71498568
                    ]
                ]
            ]
        },
        "geometry_name": "the_geom",
        "properties": {
            "fid": 15,
            "site_id": "23caa0cb-30c9-419b-9963-7056ec614fe5",
            "name": "Lawson Swamp Culvert Exit Stream",
            "activities": "[]"
        }
    },
    {
        "type": "Feature",
        "id": "swamps_surveysite.16",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [
                        150.41271329,
                        -33.72703805
                    ],
                    [
                        150.41303515,
                        -33.72715405
                    ],
                    [
                        150.41322291,
                        -33.72781435
                    ],
                    [
                        150.41297615,
                        -33.72790804
                    ],
                    [
                        150.412606,
                        -33.72733697
                    ],
                    [
                        150.41268647,
                        -33.72703805
                    ],
                    [
                        150.41271329,
                        -33.7270202
                    ],
                    [
                        150.41271329,
                        -33.72703805
                    ]
                ]
            ]
        },
        "geometry_name": "the_geom",
        "properties": {
            "fid": 16,
            "site_id": "4f494553-ec14-4197-837f-d5f502c21ed9",
            "name": "Bullaburra Swamp Piezometer",
            "activities": "[]"
        }
    },
    {
        "type": "Feature",
        "id": "swamps_surveysite.17",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [
                        150.41265965,
                        -33.72706035
                    ],
                    [
                        150.41297078,
                        -33.72710051
                    ],
                    [
                        150.41321218,
                        -33.72781435
                    ],
                    [
                        150.41296005,
                        -33.72792143
                    ],
                    [
                        150.41258991,
                        -33.72718082
                    ],
                    [
                        150.41265965,
                        -33.72706035
                    ]
                ]
            ]
        },
        "geometry_name": "the_geom",
        "properties": {
            "fid": 17,
            "site_id": "e1460811-ad65-445e-a933-84fdb25728c3",
            "name": "Bullaburra Swamp Exit Stream",
            "activities": "[]"
        }
    },
    {
        "type": "Feature",
        "id": "swamps_surveysite.18",
        "geometry": null,
        "geometry_name": "the_geom",
        "properties": {
            "fid": 18,
            "site_id": "747ac352-6ad7-438e-905a-e7a8bc2533dc",
            "name": "Project area for Blue Mountains Upland Swamps",
            "activities": "[]"
        }
    }
];

const formatSwampData = (rawData) => {
    rawData.map((site) => site);
    return data;
};

const mapStateToProps = (state) => {
    return {
        currentBiocollectSurveySiteId: state?.biocollect?.currentBiocollectSurveySiteId,
        currentBiocollectSurveySite: state?.biocollect?.swampsSurveyData?.filter((site) => site.properties.site_id === state?.biocollect?.currentBiocollectSurveySiteId)[0],
        visibleBiocollectChart: state?.biocollect?.visibleBiocollectChart,
        swampsSurveyData: state?.biocollect?.swampsSurveyData,
        lineChartData: formatSwampData(swampData)
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleBiocollectChart: (visible) => dispatch(setVisibleBiocollectChart(visible)),
        setCurrentBiocollectSurveySiteId: (siteId) => dispatch(setCurrentBiocollectSurveySiteId(siteId))
    };
};

const BiocollectChart = connect(mapStateToProps, mapDispatchToProps)(BiocollectChartClass);


export default BiocollectChart;
