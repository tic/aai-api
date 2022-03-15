// Import what we need from the config file.
const { scoring: { precision: scorePrecision } } = require("../config");


// Contains functions which compute scores given
// component air quality metrics (temp, voc, etc).
const subscore = require("./subscores");


// Averages all component subscores for
// a somewhat blended sort of AQI.
function balancedAQI(temperatureC, humidityPct, co2Ppm, vocPpb, pm25UgL) {
    const rawScore = (
        subscore.getTemperatureSubscore(temperatureC)
        + subscore.getHumiditySubscore(humidityPct)
        + subscore.getCo2Subscore(co2Ppm)
        + subscore.getVocSubscore(vocPpb)
        + subscore.getPm25Subscore(pm25UgL)
    ) / 5;

    return parseFloat(rawScore.toPrecision(scorePrecision));
}


// Todo
function occupationalAQI() {

    return 0;
}


// Todo
function environmentalAQI() {

    return 0;
}


// Export our scoring functions.
module.exports = {
    balancedAQI: balancedAQI,
    occupationalAQI: occupationalAQI,
    environmentalAQI: environmentalAQI
};
