var express = require('express');
var app = express();
var server = require('http').Server(app);
var log = require('log4js').getLogger();
var argv = require('minimist')(process.argv.slice(2));
var td = argv.mock ? require('./lib/mock-telldus.js')({numDevices: 3}) : require('telldus-core');
var config = require('config-file');
var fs = require('fs');
var moment = require('moment');
var shell = require('shelljs');
var bodyParser = require('body-parser');
app.use(bodyParser.json());

// Default configuration values
var DEFAULT_PORT = 9001;
var DEFAULT_ALARM_ENABLED = false;
var DEFAULT_ALARM_DEVICES = [];
var DEFAULT_FILTERING_ENABLED = true;
var DEFAULT_FILTERING_SECONDS = 5;
var DEFAULT_SUPPRESS_SCRIPT = "";

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

var alarmEnabled = opts.alarmEnabled || DEFAULT_ALARM_ENABLED;
var alarmDevices = opts.alarmDevices || DEFAULT_ALARM_DEVICES;
var suppressScript = opts.suppressScript || DEFAULT_SUPPRESS_SCRIPT;
var filterDuplicateEvents = DEFAULT_FILTERING_ENABLED;
var filterTimeSeconds = DEFAULT_FILTERING_SECONDS;

function generateConfigurationData() {
    var alarmDevicesConfig = alarmDevices.map(function (alarmDevice) {
     return { "deviceId": alarmDevice.deviceId };
    });
    return {
        "port": PORT,
        "alarmEnabled": alarmEnabled,
        "alarmDevices": alarmDevicesConfig,
        "nma": nmaHandler.generateConfiguration(),
        "email": emailHandler.generateConfiguration(),
        "suppressScript": suppressScript
    };
}

function saveConfigurationToFile(callback) {
    configurationData = JSON.stringify(generateConfigurationData(), null, "  ");
    log.info("Saving configuration to file: " + configurationData);
    fs.writeFile(CONFIGURATION_FILE_NAME, configurationData, "utf8", callback);
}

// Helper functions
function getAlarmString(device) {
    return moment().format("YYYY-MM-DD HH:mm:ss") + ": Device \"" + device.name + "\" with id " +
        device.id + " just turned on.";
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
        on: (device.lastSentCommand === td.TURNON)
    };
}

// Alarm handling
function sendAlarmIfNotSuppressedByScript(device) {
    var alarmDevice = getAlarmDevice(device.id);
    var duplicateDeviceEvent = isDeviceEventDuplicate(alarmDevice);
    updateLastOnForAlarmDevice(alarmDevice);
    if (!getAlarmStatus()) {
        log.info("Alarm disabled, ignoring.");
    } else if (duplicateDeviceEvent) {
        log.info("Duplicate alarm event detected for device " + device.id + ", ignoring.");
    } else if (!suppressScript) {
        sendAlarm(device);
    } else {
        log.info("Running suppressScript: ", suppressScript);
        shell.exec(suppressScript, {silent: true}, function(code, output) {
            if (code === 0) {
                log.info("Alarm suppressed by script.");
            } else {
                sendAlarm(device);
            }
        });
    }
}

function getAlarmStatus() {
    return alarmEnabled;
}

function setAlarmStatus(enabled) {
    log.info("Setting Alarm Status to: " + enabled);
    alarmEnabled = enabled;
}

function isAlarmEnabled(deviceId) {
    for (var i = 0; i < alarmDevices.length; i++) {
        if (alarmDevices[i].deviceId == deviceId) {
            return true;
        }
    }
    return false;
}

function sendAlarm(device) {
    log.info("Sending alarm.");
    var alarmData = {
        title: APP_NAME,
        subject: "Alarm",
        text: getAlarmString(device)
    }
    emailHandler.sendNotification(alarmData);
    nmaHandler.sendNotification(alarmData);
}

function checkAlarm(deviceId) {
    if (isAlarmEnabled(deviceId)) {
        getDevice(deviceId, function (error, device) {
            if (error) {
                log.error("Could not find Alarm device with ID " + deviceId, error);
            } else if (device) {
                if (isOn(device)) {
                    log.info("Alarm device with ID " + deviceId + " turned on.");
                    sendAlarmIfNotSuppressedByScript(device);
                } else {
                    log.info("Alarm device with ID " + deviceId + " turned off.");
                }
            } else {
                log.error("Could not find Alarm device with ID " + deviceId + ", weird.");
            }
        });
    }
}

function serializeAlarmDevices(alarmDevices) {
    return alarmDevices.map(serializeAlarmDevice);
}

function serializeAlarmDevice(alarmDevice) {
   var lastOn = (alarmDevice.lastOn) ? alarmDevice.lastOn.format() : "N/A";
    return {
        "deviceId": alarmDevice.deviceId,
        "lastOn":   lastOn
    };
}

function getAlarmDevices() {
    return alarmDevices;
}

function getAlarmDevice(deviceId) {
    for (var i = 0; i < alarmDevices.length; i++) {
        if (alarmDevices[i].deviceId == deviceId) {
            return alarmDevices[i];
        }
    }
    return null;
}

function addAlarmDevice(deviceId) {
    log.info("Adding alarm for device with ID: " + deviceId);
    alarmDevices.push({ "deviceId": deviceId });
}

function deleteAlarmDevice(deviceId) {
    log.info("Deleting alarm for device with ID: " + deviceId);
    for (var i = 0; i < alarmDevices.length; i++) {
        if (alarmDevices[i].deviceId == deviceId) {
            return alarmDevices.splice(i, 1);
        }
    }
    return null;
}

function updateLastOnForAlarmDevice(alarmDevice) {
    log.info("Updating lastOn for alarmDevice with id: ", alarmDevice.deviceId);
    alarmDevice.lastOn = moment();
}

// Alarm REST API
app.route('/alarm')
    .get(function(req, res) {
        res.json({"enabled" : getAlarmStatus()});
    })
    .put(function(req, res) {
        var enabled = req.body.enabled;
        setAlarmStatus(enabled);
        res.sendStatus(200);
    });

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

app.get('/alarm/devices/', function(req, res) {
    res.json(serializeAlarmDevices(getAlarmDevices()));
});

app.route('/alarm/devices/:device/')
    .get(function(req, res) {
        var deviceId = parseDeviceId(req.params.device);
        res.json(serializeAlarmDevice(getAlarmDevice(deviceId)));
    })
    .put(function(req, res) {
        var deviceId = parseDeviceId(req.params.device);
        addAlarmDevice(deviceId);
        res.sendStatus(200);
    })
    .delete(function(req, res) {
        var deviceId = parseDeviceId(req.params.device);
        if (deleteAlarmDevice(deviceId)) {
            res.sendStatus(200);
        } else {
            res.sendStatus(500);
        }
    });

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
