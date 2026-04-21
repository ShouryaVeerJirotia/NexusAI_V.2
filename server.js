const app = require("./src/app");
const { getServerConfig } = require("./src/config/app-config");

const { port, host } = getServerConfig();

app.listen(port, host, () => {
  console.log(`Nexus server is live on http://${host}:${port}`);
});
