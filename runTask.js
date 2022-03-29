
// Import and launch the score generator.
const updater = require("./scoreGenerator");
var taskRef = updater.init();
console.log("started score generator task (%s)", taskRef);
// Later on, call await updater.stop(taskRef); to stop.

// Keep the process alive. If someone knows a more 
// efficient/better way to do this, please go for it.
while(true) {}
