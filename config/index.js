// Load the environment variables.
const { parsed: parsedEnv } = require("dotenv").config();


// Define the config in a user-friendly way.
const config = {
    influx: {
        protocol: parsedEnv.INFLUX_PROTOCOL,
        host: parsedEnv.INFLUX_HOST,
        port: parsedEnv.INFLUX_PORT,
        databaseName: parsedEnv.INFLUX_DB,
        username: parsedEnv.INFLUX_USER,
        passwd: parsedEnv.INFLUX_PASSWD,
        doWrites: parsedEnv.INFLUX_DO_WRITE === "true"
    },
    scoring: {
        precision: parseInt(parsedEnv.SCORE_PRECISION),
        updatePeriod: parseInt(parsedEnv.SCORE_UPDATE_TASK_PERIOD),
        rollingInterval: parseInt(parsedEnv.ROLLING_INTERVAL_S),
        scoreTesting: parsedEnv.SCORE_TESTING === "true"
    },
    api: {
        port: parseInt(parsedEnv.API_PORT ?? 3000)
    },
    scoreTask: {
        measurement: parsedEnv.MEASUREMENT_NAME
    }
};


// Export the config file.
module.exports = config;