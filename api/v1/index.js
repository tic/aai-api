
const response = require("./responses");

async function healthCheck(req, res) {
    res.respond(new response.http200({
        message: "successful response"
    }));
}

async function healthCheck2(req, res) {
    res.respond(new response.http200({
        message: "another successful response"
    }));
}

module.exports = function(server, prefix) {
    server.get(prefix + "/", healthCheck);
    server.get(prefix + "/hc2", healthCheck2);
}
