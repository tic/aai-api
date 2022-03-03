// Contains functions which compute scores given
// component air quality metrics (temp, voc, etc).


const subscore = require("./subscores");


// Averages all component subscores
function balancedAQI(temperatureC, humidityPct, co2Ppm, vocPpb, pm25UgL) {
    return (
        subscore.getTemperatureSubscore(temperatureC)
        + subscore.getHumiditySubscore(humidityPct)
        + subscore.getCo2Subscore(co2Ppm)
        + subscore.getVocSubscore(vocPpb)
        + subscore.getPm25Subscore(pm25UgL)
    ) / 5;
}


// Todo
function occupationalAQI() {

}


// Todo
function environmentalAQI() {

}