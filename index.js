'use strict';

let _ = require('lodash');
let app = require('express')();
let request = require('superagent');
let Promise = require('bluebird');

let agent = require('superagent-promise')(request, Promise);

class ResponseError extends Error {
    constructor(message, status) {
        super(message);
        this.name = this.constructor.name;
        this.message = message;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor.name);
        } else {
            this.stack = (new Error(message)).stack;
        }

        this.status = _.isUndefined(status) ? 0 : status;
    }
};

class ServerError extends ResponseError {
    constructor (message) {
        super(message, 500);
    }
}

class BadRequestError extends ResponseError {
    constructor (message) {
        super(message, 400);
    }
}

app.get('/', function (req, res) {
    let requiredAttributes = ['address'];

    Promise.resolve(_.filter(requiredAttributes, attribute => _.isUndefined(req.query[attribute])))
    .then(missingAttributes => {
        if (missingAttributes.length) {
            throw new BadRequestError('Missing attributes: ' + missingAttributes);
        }
    })
    .then(() => agent.get('http://maps.google.com/maps/api/geocode/json?address=' + req.query.address + '&sensor=false&region=us'))
    .catch(err => {
        if (err.status === 400) {
            throw new ServerError('Error getting lat-long.')
        }

        return err;
    })
    .then(response => {
        let location = response.body.results[0].geometry.location;
        let address = response.body.results[0].formatted_address;

        let pushoverOptions = {
            token: process.env.PUSHOVER_KEY,
            user: process.env.PUSHOVER_USER,
            message: 'Navigate to ' + address + '.',
            device: 'iPhone',
            title: 'Waze Navigation',
            url: 'waze://?ll=' + location.lat + ',' + location.lng + '&navigate=yes',
            url_title: 'Open in Waze'
        };

        return request
            .post('https://api.pushover.net/1/messages.json')
            .type('form')
            .send(pushoverOptions)
        ;
    })
    .catch(err => {
        if (err.response.status === 400) {
            console.log(_.isObject(err.response.text))
            if (_.isString(err.response.text) && JSON.parse(err.response.text).token === 'invalid') {
                throw new ServerError('Unable to authenticate with Pushover.');
            }

            throw new ServerError('Error sending to Pushover.\n' + JSON.stringify(JSON.parse(err.response.text), null, '  '));
        }

        return err;
    })
    .then(pushoverResponse => res.status(200).send('Link sent'))
    .catch(ResponseError, error => res.status(error.status).send(error.message))
    .catch(error => res.status(500).send(error.toString()))
    ;
});

let server = app.listen(process.env.PORT || 3000, () => {
    let host = server.address().address;
    let port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});
