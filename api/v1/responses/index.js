// All responses extend from the base response.
class DefaultResponse {
    response = {};
    code = 200;

    constructor(responseData) {
        if(responseData instanceof Object) {
            Object.assign(this.response, responseData);
        }
    }

    toString() {
        return JSON.dumps(this.response);
    }
}


// Default response for a successful API request.
class Response200 extends DefaultResponse {
    constructor(responseData) {
        super(responseData);
        this.code = 200;
    }
}


// Default response for invalid arguments.
class Response400 extends DefaultResponse {
    constructor(responseData) {
        super(responseData);
        this.code = 400;
    }
}

// Default response for when something can't be found.
class Response404 extends DefaultResponse {
    constructor(responseData) {
        super(responseData);
        this.code = 404;
    }
}


// Default response for a failed request.
class Response500 extends DefaultResponse {
    constructor(responseData) {
        super(responseData);
        this.code = 500;
    }
}


module.exports = {
    http200: Response200,
    http400: Response400,
    http404: Response404,
    http500: Response500,
}
