
// Import and launch the score generator.
const updater = require("./scoreGenerator");
var taskRef = updater.init();
console.log("started score generator task (%s)", taskRef);
// Later on, call await updater.stop(taskRef); to stop.

taskRef.then(() => {
    console.error("loop broken: exiting");
});
console.log("loop established");
