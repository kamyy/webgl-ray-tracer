import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import App from "./component/App.tsx";
import { reduxStore } from "./redux/reducers.ts";
import * as serviceWorker from "./serviceWorker";

ReactDOM.render(
  <Provider store={reduxStore}>
    <App />
  </Provider>,
  document.getElementById("root")
);

if (module.hot) {
  module.hot.accept();
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
