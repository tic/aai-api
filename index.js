// Load the project config
const { api: apiConfig } = require("./config"); 


// Import the web API
const apiServer = require("./api");


// Actually start the API server
apiServer.listen(
    apiConfig.port,
    "",
    () => console.log("api server is now listening for requests on port %d", apiConfig.port)
);
