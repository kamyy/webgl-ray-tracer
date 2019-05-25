import * as serviceWorker from './serviceWorker';
import ReactDOM from 'react-dom';
import React from 'react';
import { 
    Provider 
}   from 'react-redux';
import { 
    store 
}   from './redux/reducers.js';

import App from './components/App.js';

ReactDOM.render(
    <Provider store={store}><App/></Provider>, 
    document.getElementById('root')
);

if (module.hot) {
    module.hot.accept();
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
