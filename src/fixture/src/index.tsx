import { render } from "preact";

const App = () => (
  <>
    <h1>Hello, world!</h1>
    <p>This is fixture page.</p>
  </>
);

render(<App />, document.getElementById("app")!);
