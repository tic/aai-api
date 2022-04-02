// Import the influx config.
const { influx: influxConfig } = require("../config");


// Import the Influx library and
// connect to the LLL database.
const Influx = require("influx");
const influxdb = new Influx.InfluxDB(`${influxConfig.protocol}://${influxConfig.username}:${influxConfig.passwd}@${influxConfig.host}:${influxConfig.port}/${influxConfig.databaseName}`);
console.log(`connecting to influx at ${influxConfig.protocol}://${influxConfig.username}:*****@${influxConfig.host}:${influxConfig.port}/${influxConfig.databaseName}`);
console.log("==============================================\nCODE REQUIRES MODIFIED LIBRARY FUNCTION\n@npm/influx/lib/src/index.js\nLine 857:\n --->>> path: options.publishPath ?? \"/write\",\n==============================================\n");

// Export a db querying function.
module.exports = {
    query: async function(queryText) {
        try {
            const result = await influxdb.query(queryText);
            return {
                success: true,
                result
            };
        } catch(err) {
            console.error(err);
            return {
                success: false,
                error: err
            };
        }
    },
    write: async function(pointsArr) {
        try {
            pointsArr.map(point => {
                Object.keys(point.fields).map(field => {
                    if( !/^[0-9A-Za-z]+\_v\d+$/.test(field) ) {
                        throw new Error(`all fields should be someString_vX (${field})`);
                    }
                })
            });

            let result;
            if(influxConfig.doWrites) {
                console.log("writes enabled. executing query");
                result = await influxdb.writePoints(
                    pointsArr,
                    {publishPath: "/gateway/write"}
                );
            } else {
                console.log("writes disabled. logging instead");
                console.log(pointsArr);
            }
            return {
                success: true
            };
        } catch(err) {
            console.error(err);
            return {
                success: false,
                error: err
            };
        }
    }
};
