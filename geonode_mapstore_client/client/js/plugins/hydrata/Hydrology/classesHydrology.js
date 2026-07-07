import {v4 as uuidv4} from "uuid";

export class IdfTable {
    constructor() {
        this.id = `temp-${uuidv4()}`;
        this.name = "New IDF Table";
        // TASK-2119 (F3-FE): these used to be literal strings ("Enter
        // description" / "Enter source") that masqueraded as placeholders —
        // a user who never touched either field got that literal text
        // PERSISTED as the actual source/description of an official IDF
        // table. Real HTML placeholder attributes on the inputs
        // (hydrologyListDetailContainer.js) now carry that guidance text
        // instead; these default to empty so an untouched field round-trips
        // as empty, not garbage.
        this.description = "";
        this.source = "";
        this.columnDefs = [
            {
                id: 'Duration (min)',
                header: 'Duration (min)',
                accessorKey: 'duration'
            },
            {
                id: "0.5yr ARI",
                header: "0.5yr ARI",
                accessorKey: "0-5yrARI"
            },
            {
                id: "1yr ARI",
                header: "1yr ARI",
                accessorKey: "1yrARI"
            },
            {
                id: "2yr ARI",
                header: "2yr ARI",
                accessorKey: "2yrARI"
            },
            {
                id: "5yr ARI",
                header: "5yr ARI",
                accessorKey: "5yrARI"
            },
            {
                id: "10yr ARI",
                header: "10yr ARI",
                accessorKey: "10yrARI"
            },
            {
                id: "20yr ARI",
                header: "20yr ARI",
                accessorKey: "20yrARI"
            },
            {
                id: "50yr ARI",
                header: "50yr ARI",
                accessorKey: "50yrARI"
            },
            {
                id: "100yr ARI",
                header: "100yr ARI",
                accessorKey: "100yrARI"
            },
            {
                id: "500yr ARI",
                header: "500yr ARI",
                accessorKey: "500yrARI"
            }
        ];
        // Default durations cover the full standard sub-hourly range
        // (5/10/15/20/30/45 min) plus the canonical >=1h set. (15/20/45 min
        // were briefly dropped under TASK-1497 UAT note-3 but restored on
        // request — sub-hourly resolution matters for short-duration design
        // storms; users can still add/remove any duration manually.)
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

    updateIntensityValues(rowIndex, columnId, value) {
        this.rowData = this.rowData.map((row, index) => {
            if (index === rowIndex) {
                return {
                    ...row,
                    [columnId]: value
                };
            }
            return row;
        });
    }


    addDuration(_minutes)  {
        return null;
    }

    removeDuration(_minutes)  {
        return null;
    }

    addFrequency(_label, _ari) {
        return null;
    }

    removeFrequency(_ariOrLabel) {
        return null;
    }

    getChartData() {
        let lines = {};
        const frequencies = this.columnDefs.filter(columnDef => columnDef?.ari);
        frequencies.map(frequency => {
            const filteredRows = this.rowData.filter(row => parseFloat(row[frequency.accessorKey]) !== 0);
            lines[frequency.accessorKey] = filteredRows.map((row, index) => {
                let data = {
                    "duration": row.duration,
                    "intensity": parseFloat(row[frequency.accessorKey])
                };
                if (index === filteredRows.length - 1) {
                    data.label = frequency.accessorKey;
                } else {
                    data.label = '';
                }
                return data;
            });
        });
        return lines;
    }
}

export class TemporalPattern {
    constructor() {
        this.id = `temp-${uuidv4()}`;
        this.name = "New TemporalPattern";
        this.description = "Enter description";
        this.source = "Enter source";
        // TASK-1531: declare pattern_key on the instance so the save epic's
        // {...item} spread always forwards it (a property only set later via
        // SET_TEMPORAL_PATTERN_PRESET would be absent on a never-touched item).
        // null = no preset chosen yet (alternating-block / custom default).
        this.pattern_key = null;
        this.columnDefs = [
            {
                header: 'Percentage',
                accessorKey: 'percentage'
            }
        ];
        this.rowData = [
            {
                "percentage": 10
            },
            {
                "percentage": 10
            },
            {
                "percentage": 10
            },
            {
                "percentage": 10
            },
            {
                "percentage": 10
            },
            {
                "percentage": 10
            },
            {
                "percentage": 10
            },
            {
                "percentage": 10
            },
            {
                "percentage": 10
            },
            {
                "percentage": 10
            },
            {
                "percentage": 0
            },
            {
                "percentage": 0
            },
            {
                "percentage": 0
            },
            {
                "percentage": 0
            },
            {
                "percentage": 0
            }
        ];
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

    updatePercentageValues(rowIndex, columnId, value) {
        let newRowData = [...this.rowData];
        newRowData[rowIndex] = {...newRowData[rowIndex], [columnId]: parseFloat(value)};
        this.rowData = newRowData;
    }

    getChartData() {
        return this.rowData;
    }
}

export class TimeSeries {
    constructor() {
        this.id = `temp-${uuidv4()}`;
        this.name = "New Time Series";
        this.description = "Enter description";
        this.source = "Enter source";
        this.columnDefs = [
            {
                header: 'TimeStamp',
                accessorKey: 'timestamp'
            },
            {
                header: "Value",
                accessorKey: "value"
            }
        ];
        // TASK-2004 (epic-2001 W1c): seed a new Design Storm / time-series with
        // an all-ZERO short grid (4 representative hourly timestamps) so the
        // Create panel opens an empty editable hyetograph rather than a fake
        // 0/10/30/0 sample storm the user has to clear. Keeps the 4-row grid so
        // the chart/grid still render with a visible time axis.
        //
        // TASK-2085 (epic-2077): these MUST be literal UTC ISO strings, not a
        // `new Date("2000-01-01T00:00:00").toISOString()` round-trip. That
        // round-trip parses the naive (no "Z"/offset) literal as LOCAL time
        // (ES2015 Date Time String spec), then `.toISOString()` converts back
        // to UTC — so in any viewer ahead of UTC (e.g. UTC+10) the seed rolls
        // back to 1999-12-31. Writing the literal directly is tz-independent
        // and matches the BE derive convention of anchoring new rows at a
        // fixed 2000-01-01 UTC (design_storm.py:718-729, tz-aware
        // `datetime(2000, 1, 1, 0, 0, 0, tzinfo=timezone.utc)`).
        this.rowData = [
            {
                "timestamp": "2000-01-01T00:00:00.000",
                "value": 0
            },
            {
                "timestamp": "2000-01-01T01:00:00.000",
                "value": 0
            },
            {
                "timestamp": "2000-01-01T02:00:00.000",
                "value": 0
            },
            {
                "timestamp": "2000-01-01T03:00:00.000",
                "value": 0
            }
        ];
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

    updateRowValues(rowIndex, columnId, value) {
        let newRowData = [...this.rowData];
        if (newRowData[rowIndex] && columnId in newRowData[rowIndex]) {
            newRowData[rowIndex] = { ...newRowData[rowIndex], [columnId]: value };
        } else {
            console.warn(`Invalid rowIndex or keyId: rowIndex = ${rowIndex}, columnId = ${columnId}`);
        }
        this.rowData = newRowData;
    }

    setUnsavedStatus(newStatus) {
        this.saved = newStatus;
    }

    setRowData(rowData) {
        this.rowData = rowData;
    }

    getChartData() {
        return this.rowData.map(datapoint => ({ ...datapoint, timestamp: new Date(datapoint.timestamp).getTime()}));
    }
}

