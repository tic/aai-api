// Import express and create the web server
const server = require("express")();


// Define a quick function to save us a few
// lines of work in each API response handler.
server.use("/", (req, res, next) => {
    res.respond = function(responseObject) {
        res.status(responseObject.code);
        res.json(responseObject.response);
    }
    next();
});


// Import version 1 API
const apiV1 = require("./v1");


// Tell the server to use V1 endpoints
// on all URLs beginning with V1.
apiV1(server, "/v1");


// Export the server so the main
// file can run it when ready.
module.exports = server;
