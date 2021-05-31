
import { connect } from 'react-redux';
import Home from '@js/routes/Home';

const SearchRoute = connect(() => ({ hideHero: true, isFilterForm: true })
)((Home));

export default SearchRoute;
