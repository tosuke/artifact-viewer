import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { pathToRegexp } from "path-to-regexp";
import { artifactPath } from "./constants";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", {
    type: import.meta.env.PROD ? "classic" : "module",
    scope: "/",
  });
}

const artifactPathRegex = pathToRegexp(artifactPath);

const App = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then(() => {
          if (artifactPathRegex.test(window.location.pathname)) {
            location.reload();
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, []);

  if (loading) return null;

  return <div></div>;
};

render(<App />, document.getElementById("app")!);
