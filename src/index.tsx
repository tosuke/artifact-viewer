if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", {
      type: import.meta.env.PROD ? "classic" : "module",
      scope: "/",
    })
    .catch((err: unknown) => {
      console.error(err);
    });
}
