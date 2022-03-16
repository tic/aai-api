// Load the project config.
const { api: apiConfig } = require("./config"); 


// Import the web API.
const apiServer = require("./api");


// Actually start the API server.
apiServer.listen(
    apiConfig.port,
    "",
    () => console.log("api server is now listening for requests on port %d", apiConfig.port)
);


// This is an example of how to use
// the database query mechanism. If
// you want to try it, just uncomment.
// const db = require("./db");
// db.query("SELECT * FROM \"awair_score\" WHERE awair_mac_address != '' and time > now() - 1m")
// .then(r => {
//     if(!r.success) {
//         console.error(r.error);
//         return;
//     }
//     const rows = r.result;
//     console.log(
//         rows.map(row => ({
//             time: row.time._nanoISO,
//             mac: row.awair_mac_address,
//             value: row.value
//         }))
//     );
// });
