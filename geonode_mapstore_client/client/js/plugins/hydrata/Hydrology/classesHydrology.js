import {v4 as uuidv4} from "uuid";

export class IdfTable {
    constructor() {
        this.id = `temp-${uuidv4()}`;
        this.name = "New IDF Table";
        this.description = "Enter description";
        this.source = "Enter source";
        this.columnDefs = [
            {
                headerName: 'Duration (min)',
                field: 'duration',
                pinned: 'left',
                width: 100
            },
            {
                headerName: "0.5yr ARI",
                field: "0-5yrARI",
                stakeholderLabel: "2 EY",
                ari: 0.5,
                editable: true,
                width: 60,
                valueParser: params => Number(params.newValue)
            },
            {
                headerName: "1yr ARI",
                field: "1yrARI",
                stakeholderLabel: "1 EY",
                ari: 1,
                editable: true,
                width: 60,
                valueParser: params => Number(params.newValue)
            },
            {
                headerName: "2yr ARI",
                field: "2yrARI",
                stakeholderLabel: "40% AEP",
                ari: 2,
                editable: true,
                width: 60,
                valueParser: params => Number(params.newValue)
            },
            {
                headerName: "5yr ARI",
                field: "5yrARI",
                stakeholderLabel: "40% AEP",
                ari: 5,
                editable: true,
                width: 60,
                valueParser: params => Number(params.newValue)
            },
            {
                headerName: "10yr ARI",
                field: "10yrARI",
                stakeholderLabel: "40% AEP",
                ari: 10,
                editable: true,
                width: 60,
                valueParser: params => Number(params.newValue)
            },
            {
                headerName: "20yr ARI",
                field: "20yrARI",
                stakeholderLabel: "5% AEP",
                ari: 20,
                editable: true,
                width: 60,
                valueParser: params => Number(params.newValue)
            },
            {
                headerName: "50yr ARI",
                field: "50yrARI",
                stakeholderLabel: "2% AEP",
                ari: 50,
                editable: true,
                width: 60,
                valueParser: params => Number(params.newValue)
            },
            {
                headerName: "100yr ARI",
                field: "100yrARI",
                stakeholderLabel: "1% AEP",
                ari: 100,
                editable: true,
                width: 60,
                valueParser: params => Number(params.newValue)
            },
            {
                headerName: "500yr ARI",
                field: "500yrARI",
                stakeholderLabel: "0.2% AEP",
                ari: 500,
                editable: true,
                width: 60,
                valueParser: params => Number(params.newValue)
            }
        ];
        this.rowData = [
            {
                "duration": 5,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 10,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 15,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 20,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 30,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 45,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 60,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 120,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 180,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 240,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 300,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 360,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 540,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 720,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 900,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 1080,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 1440,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 2880,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            },
            {
                "duration": 4320,
                "0-5yrARI": 0,
                "1yrARI": 0,
                "2yrARI": 0,
                "5yrARI": 0,
                "10yrARI": 0,
                "20yrARI": 0,
                "50yrARI": 0,
                "100yrARI": 0,
                "500yrARI": 0
            }
        ];
        this.intensityUnits = "mm/hr";
    }

    get data() {
        return {
            columnDefs: this.columnDefs,
            rowData: this.rowData
        };
    }

    set data(value) {
        if (typeof value !== 'object') {
            throw new TypeError("'data' expects an object");
        }

        if ('columnDefs' in value) {
            this.columnDefs = value.columnDefs;
        }

        if ('rowData' in value) {
            this.rowData = value.rowData;
        }
    }

    updateProperties(kv) {
        Object.keys(kv).forEach(key => {
            this[key] = kv[key];
        });
    }

    updateIntensityValues(rowData) {
        let updatedRowDuration = parseInt(rowData.duration, 10);
        for (const existingRowData of this.rowData) {
            for (const durationToCheck in existingRowData.duration) {
                if (parseInt(durationToCheck, 10) === updatedRowDuration) {
                    for (const frequency in rowData) {
                        if (frequency !== "duration" && existingRowData.field === frequency) {
                            existingRowData.durations[durationToCheck] = rowData[frequency] === "-" ? 0 : parseInt(rowData[frequency], 10);
                        }
                    }
                }
            }
        }
    }
    addDuration(minutes)  {
        return null;
    }

    removeDuration(minutes)  {
        return null;
    }

    addFrequency(label, ari) {
        return null;
    }

    removeFrequency(ariOrLabel) {
        return null;
    }

    getChartData() {
        let lines = {};
        const frequencies = this.columnDefs.filter(columnDef => columnDef?.ari);
        frequencies.map(frequency => {
            lines[frequency.field] = this.rowData
                .filter(row => parseFloat(row[frequency.field]) !== 0)
                .map(row => ({
                    "duration": row.duration,
                    "intensity": parseFloat(row[frequency.field]),
                    "label": frequency.field
                }));
        });
        console.log("getChartData", lines);
        return lines;
    }
}
