// All responses extend from the base response.
class DefaultResponse {
    response = {};
    code = 200;

    constructor() {}

    toString() {
        return JSON.dumps(this.response);
    }
}


// Default response for a successful API request
class Response200 extends DefaultResponse {
    constructor(responseComponents) {
        super();
        this.code = 200;
        if(responseComponents instanceof Object) {
            Object.assign(this.response, responseComponents);
        }
    }
}

module.exports = {
    http200: Response200
}
