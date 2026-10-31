import { main } from "./docs.js";

main({ document, location: window.location, fetch: window.fetch.bind(window) });
