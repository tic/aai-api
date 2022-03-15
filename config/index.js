// Load the environment variables.
const { parsed: parsedEnv } = require("dotenv").config();


// Define the config in a user-friendly way.
const config = {
    influx: {
        host: parsedEnv.INFLUX_HOST,
        port: parsedEnv.INFLUX_PORT,
        databaseName: parsedEnv.INFLUX_DB,
        username: parsedEnv.INFLUX_USER,
        passwd: parsedEnv.INFLUX_PASSWD
    },
    scoring: {
        precision: parseInt(parsedEnv.SCORE_PRECISION),
        updatePeriod: parseInt(parsedEnv.SCORE_UPDATE_TASK_PERIOD)
    },
    api: {
        port: parseInt(parsedEnv.API_PORT)
    }
};


// Export the config file.
module.exports = config;