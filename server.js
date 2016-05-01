var express = require('express');
var app = express();
var server = require('http').Server(app);
var log = require('log4js').getLogger();
var argv = require('minimist')(process.argv.slice(2));
var td = argv.mock ? require('./lib/mock-telldus.js')({numDevices: 3}) : require('telldus-core');
var config = require('config-file');
var fs = require('fs');
var moment = require('moment');
var bodyParser = require('body-parser');
app.use(bodyParser.json());

// Default configuration values
var DEFAULT_PORT = 9001;
var DEFAULT_FILTERING_ENABLED = true;
var DEFAULT_FILTERING_SECONDS = 5;

// Configuration handling
var CONFIGURATION_FILE_NAME = "alarmail.json";
var opts = config(config.resolve(CONFIGURATION_FILE_NAME));

var PORT = (process.env.PORT || opts.port || DEFAULT_PORT);
var LOG_LEVEL = (process.env.LOG_LEVEL || "INFO");
log.setLevel(LOG_LEVEL);

var APP_NAME = "Alarmail";

var EmailHandler = require('./lib/email-handler.js');
var emailHandler = new EmailHandler(log, opts);

var NMAHandler = require('./lib/nma-handler.js');
var nmaHandler = new NMAHandler(log, opts);

var AlarmHandler = require('./lib/alarm-handler.js');
var alarmHandler = new AlarmHandler(log, opts, [emailHandler, nmaHandler]);

var filterDuplicateEvents = DEFAULT_FILTERING_ENABLED;
var filterTimeSeconds = DEFAULT_FILTERING_SECONDS;

function generateConfigurationData() {
    return {
        "port": PORT,
        "alarm": alarmHandler.generateConfiguration(),
        "nma": nmaHandler.generateConfiguration(),
        "email": emailHandler.generateConfiguration(),
    };
}

function saveConfigurationToFile(callback) {
    configurationData = JSON.stringify(generateConfigurationData(), null, "  ");
    log.info("Saving configuration to file: " + configurationData);
    fs.writeFile(CONFIGURATION_FILE_NAME, configurationData, "utf8", callback);
}

// Filtering handling
function isDeviceEventDuplicate(alarmDevice) {
    var now = moment();
    var duplicate = false;
    if (alarmDevice.lastOn) {
        duplicate = (now.diff(alarmDevice.lastOn, 'seconds') < filterTimeSeconds);
    }
    if (!duplicate) {
        alarmDevice.lastOn = now;
    }
    return duplicate;
}

// Device handling
td.on('device', checkAlarm);

function isOn(device) {
    return device.lastSentCommand === td.TURNON;
}

function findById(id, items) {
    for (var i = 0; i < items.length; ++i) {
        var item = items[i];

        if (item.id === id) {
            return item;
        }
    }

    return null;
}

function getDevice(id, callback) {
    td.getDevices(function (error, devices) {
        if (error) {
            callback(error);
        } else {
            callback(null, findById(id, devices));
        }
    });
}

function parseDeviceId(deviceParam) {
    if (/^[0-9]+$/.test(deviceParam)) {
        return parseInt(deviceParam, 10);
    }
}

function serializeDevices(devices) {
    return devices.map(serializeDevice);
}

function serializeDevice(device) {
    return {
        id:   device.id,
        name: device.name,
        on:   (device.lastSentCommand === td.TURNON)
    };
}

// Helper functions
function getAlarmData(device) {
    var alarmText = moment().format("YYYY-MM-DD HH:mm:ss") + ": Device \"" + device.name + "\" with id " +
        device.id + " just turned on.";
    return {
        title: APP_NAME,
        subject: "Alarm",
        text: alarmText
    };
}

// Alarm handling
function sendAlarmIfNotDuplicateEvent(device) {
    var alarmDevice = alarmHandler.getDevice(device.id);
    var duplicateDeviceEvent = isDeviceEventDuplicate(alarmDevice);
    alarmHandler.setLastOnForDevice(alarmDevice.deviceId);
    if (duplicateDeviceEvent) {
        log.info("Duplicate alarm event detected for device " + device.id + ", ignoring.");
    } else {
        alarmHandler.handleAlarm(getAlarmData(device));
    }
}

function checkAlarm(deviceId) {
    if (alarmHandler.isAlarmEnabledForDevice(deviceId)) {
        getDevice(deviceId, function (error, device) {
            if (error) {
                log.error("Could not find Alarm device with ID " + deviceId, error);
            } else if (device) {
                if (isOn(device)) {
                    log.info("Alarm device with ID " + deviceId + " turned on.");
                    sendAlarmIfNotDuplicateEvent(device);
                } else {
                    log.info("Alarm device with ID " + deviceId + " turned off.");
                }
            } else {
                log.error("Could not find Alarm device with ID " + deviceId + ", weird.");
            }
        });
    }
}

// Alarm REST API
app.route('/alarm')
    .get(function(req, res) {
        res.json({"enabled" : alarmHandler.getEnabled()});
    })
    .put(function(req, res) {
        var enabled = req.body.enabled;
        alarmHandler.setEnabled(enabled);
        res.sendStatus(200);
    });

app.get('/alarm/devices/', function(req, res) {
    res.json(alarmHandler.getSerializedDevices());
});

app.route('/alarm/devices/:device/')
    .get(function(req, res) {
        var deviceId = parseDeviceId(req.params.device);
        res.json(alarmHandler.serializeDevice(alarmHandler.getDevice(deviceId)));
    })
    .put(function(req, res) {
        var deviceId = parseDeviceId(req.params.device);
        alarmHandler.addDevice(deviceId);
        res.sendStatus(200);
    })
    .delete(function(req, res) {
        var deviceId = parseDeviceId(req.params.device);
        if (alarmHandler.deleteDevice(deviceId)) {
            res.sendStatus(200);
        } else {
            res.sendStatus(500);
        }
    });

// NMA REST API
app.route('/alarm/nma/')
    .get(function(req, res) {
        res.json({
            "enabled" : nmaHandler.getEnabled(),
            "apiKey": nmaHandler.getApiKey()
        });
    })
    .put(function(req, res) {
        var enabled = req.body.enabled;
        nmaHandler.setEnabled(enabled);

        var apiKey = req.body.apiKey;
        nmaHandler.setApiKey(apiKey);
        res.sendStatus(200);
    });

app.route('/alarm/nma/apiKey')
    .get(function(req, res) {
        res.json({
            "apiKey": nmaHandler.getApiKey()
        });
    })
    .put(function(req, res) {
        var apiKey = req.body.apiKey;
        nmaHandler.setApiKey(apiKey);
        res.sendStatus(200);
    });

app.route('/alarm/nma/enabled')
    .get(function(req, res) {
        res.json({
            "enabled": nmaHandler.getApiKey()
        });
    })
    .put(function(req, res) {
        var enabled = req.body.enabled;
        nmaHandler.setEnabled(enabled);
        res.sendStatus(200);
    });

// Email REST API
app.route('/alarm/email/')
    .get(function(req, res) {
        res.json({
            "enabled": emailHandler.getEnabled(),
            "emailNotificationAddress": emailHandler.getEmailAddress()
        });
    })
    .put(function(req, res) {
        var enabled = req.body.enabled;
        emailHandler.setEnabled(enabled);

        var emailAddress = req.body.emailAddress;
        emailHandler.setEmailAddress(emailAddress);
        res.sendStatus(200);
    });

app.route('/alarm/email/address')
    .get(function(req, res) {
        res.json({
            "emailNotificationAddress": emailHandler.getEmailAddress()
        });
    })
    .put(function(req, res) {
        var emailNotificationAddress = req.body.emailNotificationAddress;
        emailHandler.setEmailAddress(emailNotificationAddress);
        res.sendStatus(200);
    });

app.route('/alarm/email/enabled')
    .get(function(req, res) {
        res.json({
            "enabled": emailHandler.getEnabled()
        });
    })
    .put(function(req, res) {
        var enabled = req.body.enabled;
        emailHandler.setEnabled(enabled);
        res.sendStatus(200);
    });

// Configuration file
app.put('/configuration/', function(req, res) {
    saveConfigurationToFile(function (error, device) {
        if (error) {
            log.error("Could not save configuration to file: ", error);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

// Devices REST API
app.get('/devices/', function(req, res) {
    td.getDevices(function (error, devices) {
        if (error) {
            res.sendStatus(500);
        } else {
            res.json(serializeDevices(devices));
        }
    });
});

app.get('/devices/:device/', function(req, res) {
    var deviceId = parseDeviceId(req.params.device);
    getDevice(deviceId, function (error, device) {
        if (error) {
            res.sendStatus(500);
        } else if (device) {
            res.json(serializeDevice(device));
        } else {
            res.sendStatus(404);
        }
    });
});

// Serve static files from public/
app.use(express.static(__dirname + '/public'));

server.listen(PORT);
log.info('Server listening on port ' + PORT);
