export const CIRCLE_SIZE = 100;

export const POLLUTANTS = [
    {
        name: 'Phosphorus',
        load_red_total_key: 'total_p_load_reduction',
        title: 'Phosphorus Load reductions (lbs/year)',
        initial: 'p'
    },
    {
        name: 'Nitrogen',
        load_red_total_key: 'total_n_load_reduction',
        title: 'Nitrogen Load reductions (lbs/year)',
        initial: 'n'
    },
    {
        name: 'Sediment',
        load_red_total_key: 'total_s_load_reduction',
        title: 'Sediment Load reductions (tons/year)',
        initial: 's'
    },
    {
        name: 'Total',
        load_red_total_key: 'calculated_watershed_area',
        title: 'Treated Area (acres)',
        initial: 'a'
    }
];

export const CHART_COLOURS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042',
    '#39CCCC', '#7FDBFF', '#0074D9', '#001f3f',
    '#FFDC00', '#01FF70', '#2ECC40', '#3D9970',
    '#DDDDDD', '#AAAAAA', '#B10DC9', '#F012BE',
    '#85144b', '#FF4136', '#FF851B', '#FFFFFF',
    '#0088FEAA', '#00C49FAA', '#FFBB28AA', '#FF8042AA',
    '#39CCCCAA', '#7FDBFFAA', '#0074D9AA', '#001f3fAA'
];
