var _ = require('lodash');
var app = require('express')();
var request = require('superagent')

var server;

app.get('/', function (req, res) {
    if (req.query.address) {
        return request
            .get('http://maps.google.com/maps/api/geocode/json?address=' + req.query.address + '&sensor=false&region=us')
            .end(function (err, response) {
                var address;
                var location;
                var pushoverOptions;
                var pushoverBody;

                if (err) {
                    // Send to Pushover
                    return res.status(500).send('Error getting lat-long.');
                }

                location = response.body.results[0].geometry.location;
                address = response.body.results[0].formatted_address;

                pushoverOptions = {
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
                    .end(function (err, pushoverResponse) {
                        return res.status(500).send('Error sending to Pushover.\n\n' + JSON.stringify(err, null, '  '));
                    })
                ;
            })
        ;
    }

    return res.status(400).send('Malformed request.');
});

server = app.listen(process.env.PORT || 3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});
