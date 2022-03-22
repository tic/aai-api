// Contains functions that compute component
// subscores (i.e. co2 score, etc).


// Temperature subscore calculation
function getTemperatureSubscore(temperatureC) {
    return 100 - 4.8 * Math.abs(temperatureC - 21.5);
}


// Humidity subscore calculation
function getHumiditySubscore(humidityPct) {
    const nX = humidityPct/10 - 2;
    const cubicExp = (0.58 * nX^3) - (0.6 * nX^2) + (1.4 * nX) + 9.5;
    return 100 - 3 * cubicExp;
}


// CO2 subscore calculation
function getCo2Subscore(co2Ppm) {
    return Math.min(
        100, 
        0.434 * ((co2Ppm / 100) - 50)^2
    );
}


// VOC subscore calculation
function getVocSubscore(vocPpb) {
    return 95 * Math.exp(-0.00013 * vocPpb);
}


// PM2.5 subscore calculation
function getPm25Subscore(pm25UgL) {
    return 100 * Math.exp(0.008 * pm25UgL);
}

module.exports = {
    getTemperatureSubscore,
    getHumiditySubscore,
    getCo2Subscore,
    getVocSubscore,
    getPm25Subscore
};
