// TODO
// Needs to login to the database and export something
// that lets you query. Files importing this one will
// try to run db.query(..), so the export needs to be
// sure to define query.


// This might require token management: https://github.com/influxdata/influxdb-client-js/blob/master/examples/tokens.js
// Other Influx client examples: https://github.com/influxdata/influxdb-client-js/tree/master/examples


module.exports = {
    // TODO
    query: async function() {
        console.log("Implement me! -db.query");
    }
};