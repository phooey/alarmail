var express = require('express');
var app = express();
var server = require('http').Server(app);
var log = require('log4js').getLogger();
var td = require('telldus-core');
var nma = require('nma');
var config = require('config-file');
var fs = require('fs');
var moment = require('moment');
var nodemailer = require('nodemailer');
var shell = require('shelljs');
var bodyParser = require('body-parser');
app.use(bodyParser.json());

// Default configuration values
var DEFAULT_PORT = 9001;
var DEFAULT_ALARM_ENABLED = false;
var DEFAULT_ALARM_DEVICE_ID = -1;
var DEFAULT_NMA_API_KEY = "";
var DEFAULT_NMA_ENABLED = false;
var DEFAULT_EMAIL_NOTIFICATION_ENABLED = false;
var DEFAULT_EMAIL_NOTIFICATION_ADDRESS = "";
var DEFAULT_NODEMAILER_CONFIG = null;
var DEFAULT_FILTERING_ENABLED = true;
var DEFAULT_FILTERING_SECONDS = 5;
var DEFAULT_SUPPRESS_SCRIPT = "";

// Configuration handling
var CONFIGURATION_FILE_NAME = "alarmail.json";
var opts = config(config.resolve(CONFIGURATION_FILE_NAME));

var PORT = (process.env.PORT || opts.port || DEFAULT_PORT);
var APP_NAME = "Alarmail";

var alarmEnabled = opts.alarmEnabled || DEFAULT_ALARM_ENABLED;
var alarmDeviceID = opts.alarmDeviceID || DEFAULT_ALARM_DEVICE_ID;
var nmaEnabled = opts.nmaEnabled || DEFAULT_NMA_ENABLED;
var nmaApiKey = opts.nmaApiKey || DEFAULT_NMA_API_KEY;
var emailNotificationEnabled = opts.emailNotificationEnabled || DEFAULT_EMAIL_NOTIFICATION_ENABLED;
var emailNotificationAddress = opts.emailNotificationAddress || DEFAULT_EMAIL_NOTIFICATION_ADDRESS;
var nodemailerConfig = opts.nodemailerConfig || DEFAULT_NODEMAILER_CONFIG;
var suppressScript = opts.suppressScript || DEFAULT_SUPPRESS_SCRIPT;
var filterDuplicateEvents = DEFAULT_FILTERING_ENABLED;
var filterTimeSeconds = DEFAULT_FILTERING_SECONDS;

function generateConfigurationData() {
    return {
        "port": PORT,
        "alarmEnabled": alarmEnabled,
        "alarmDeviceID": alarmDeviceID,
        "nmaEnabled": nmaEnabled,
        "nmaApiKey": nmaApiKey,
        "emailNotificationEnabled": emailNotificationEnabled,
        "emailNotificationAddress": emailNotificationAddress,
        "nodemailerConfig": nodemailerConfig,
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
var lastAlarm;

function isDeviceEventDuplicate() {
    var now = moment();
    var duplicate = false;
    if (lastAlarm) {
        duplicate = (now.diff(lastAlarm, 'seconds') < filterTimeSeconds);
    }
    if (!duplicate) {
        lastAlarm = now;
    }
    return duplicate;
}

// Nodemailer handling
function sendEmailNotification(device) {
    if (!emailNotificationEnabled) {
        return;
    } else if (!emailNotificationAddress) {
        log.info("No valid emailNotificationAddress, not sending email notification.");
        return;
    } else if (!nodemailerConfig) {
        log.info("No valid nodemailer config, not sending email notification.");
        return;
    }
    // TODO: Unnecessary to recreate transporter for each email
    var transporter = nodemailer.createTransport(nodemailerConfig);
    var mailOptions = {
        from: APP_NAME + nodemailerConfig.auth.user,
        to: emailNotificationAddress,
        subject: 'Alarm',
        text: getAlarmString(device)
    }
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            return log.error("Could not send email notification: " + error);
        }
        log.info('Sent email notification: ' + info.response);
    });
}

// NMA handling
function sendNMANotification(device) {
    if (!nmaEnabled) {
        return;
    }
    if (!nmaApiKey) {
        log.info("Could not send NMA notification: No NMA API key configured.");
        return;
    }
    nma({
      "apikey": nmaApiKey,
      "application": APP_NAME,
      "event": "Alarm",
      "description": getAlarmString(device),
      "priority": 0,
      "content-type": "text/plain"
    }, function (error) {
        if (error) {
            log.error("Could not send NMA notification: ", error);
        } else {
            log.info("Successfully sent NMA notification.");
        }
    });
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
        alarmEnabled: isAlarmEnabled(device)
    };
}

// Alarm handling
function isAlarmedSuppressedByScript() {
    if (!suppressScript) {
        return false;
    }
    var result = shell.exec(suppressScript).code;
    return (result == 0);
}

function getAlarmStatus() {
    return alarmEnabled;
}

function setAlarmStatus(enabled) {
    log.info("Setting Alarm Status to: " + enabled)
    alarmEnabled = enabled;
}

function isAlarmEnabled(device) {
    return (device.id == alarmDeviceID);
}

function sendAlarm(device) {
    if (alarmEnabled) {
        if (isDeviceEventDuplicate()) {
            log.info("Duplicate alarm event detected for device " + device.id + ", ignoring.");
            return;
        }
        log.info("Sending alarm.");
        sendNMANotification(device);
        sendEmailNotification(device);
    }
}

function checkAlarm(deviceId) {
    if (deviceId == alarmDeviceID) {
        getDevice(alarmDeviceID, function (error, device) {
            if (error) {
                log.error("Could not find Alarm device", error);
            } else if (device) {
                if (isOn(device)) {
                    log.info("Alarm device turned on.");
                    if (isAlarmedSuppressedByScript()) {
                        log.info("Alarm suppressed by script " + suppressScript + ".");
                    } else {
                        sendAlarm(device);
                    }
                } else {
                    log.info("Alarm device turned off.");
                }
            } else {
                log.error("Could not find Alarm device, weird.");
            }
        });
    }
}

function setAlarmDevice(device) {
    log.info("Setting Alarm Device ID to: " + device.id)
    alarmDeviceID = device.id;
}

function isNmaEnabled() {
    return nmaEnabled;
}

function getNmaApiKey() {
    return nmaApiKey;
}

function setNmaEnabled(enabled) {
    log.info("Setting NMA enabled to: " + enabled)
    nmaEnabled = enabled;
}

function setNmaApiKey(apiKey) {
    log.info("Setting NMA API key to: " + apiKey)
    nmaApiKey = apiKey;
}

function isEmailNotificationEnabled() {
    return emailNotificationEnabled;
}

function getEmailNotificationAddress() {
    return emailNotificationAddress;
}

function setEmailEnabled(enabled) {
    log.info("Setting email notifications enabled to: " + enabled)
    emailNotificationEnabled = enabled;
}

function setEmailNotificationAddress(emailAddress) {
    log.info("Setting email notification address to: " + emailAddress)
    emailNotificationAddress = emailAddress;
}

// Alarm REST API
app.route('/alarm')
    .get(function(req, res) {
        res.send({"enabled" : getAlarmStatus()});
    })
    .put(function(req, res) {
        var enabled = req.body.enabled;
        setAlarmStatus(enabled);
        res.sendStatus(200);
    });

app.route('/alarm/nma/')
    .get(function(req, res) {
        res.send({
            "enabled" : isNmaEnabled(),
            "apiKey": getNmaApiKey()
        });
    })
    .put(function(req, res) {
        var enabled = req.body.enabled;
        setNmaEnabled(enabled);

        var apiKey = req.body.apiKey;
        setNmaApiKey(apiKey);
        res.sendStatus(200);
    });

app.route('/alarm/nma/apiKey')
    .get(function(req, res) {
        res.send({
            "apiKey": getNmaApiKey()
        });
    })
    .put(function(req, res) {
        var apiKey = req.body.apiKey;
        setNmaApiKey(apiKey);
        res.sendStatus(200);
    });

app.route('/alarm/nma/enabled')
    .get(function(req, res) {
        res.send({
            "enabled" : isNmaEnabled()
        });
    })
    .put(function(req, res) {
        var enabled = req.body.enabled;
        setNmaEnabled(enabled);
        res.sendStatus(200);
    });

app.route('/alarm/email/')
    .get(function(req, res) {
        res.send({
            "enabled" : isEmailNotificationEnabled(),
            "emailNotificationAddress": getEmailNotificationAddress()
        });
    })
    .put(function(req, res) {
        var enabled = req.body.enabled;
        setEmailEnabled(enabled);

        var emailAddress = req.body.emailAddress;
        setEmailNotificationAddress(emailAddress);
        res.sendStatus(200);
    });

app.route('/alarm/email/address')
    .get(function(req, res) {
        res.send({
            "emailNotificationAddress": getEmailNotificationAddress()
        });
    })
    .put(function(req, res) {
        var emailNotificationAddress = req.body.emailNotificationAddress;
        setEmailNotificationAddress(emailNotificationAddress);
        res.sendStatus(200);
    });

app.route('/alarm/email/enabled')
    .get(function(req, res) {
        res.send({
            "enabled" : isEmailNotificationEnabled()
        });
    })
    .put(function(req, res) {
        var enabled = req.body.enabled;
        setEmailEnabled(enabled);
        res.sendStatus(200);
    });

app.put('/configuration/', function(req, res) {
    saveConfigurationToFile(function (error, device) {
        if (error) {
            log.error("Could not save configuration to file: " + error);
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
            res.send(serializeDevices(devices));
        }
    });
});

app.get('/devices/:device/', function(req, res) {
    var deviceId = parseDeviceId(req.params.device);
    getDevice(deviceId, function (error, device) {
        if (error) {
            res.sendStatus(500);
        } else if (device) {
            res.send(serializeDevice(device));
        } else {
            res.sendStatus(404);
        }
    });
});

/* TODO: Remove alarm route when supporting multiple devices and set
 *       alarmEnabled as property on devices instead using PUT */
app.route('/devices/:device/alarm/')
    .get(function(req, res) {
        var deviceId = parseDeviceId(req.params.device);
        getDevice(deviceId, function (error, device) {
            if (error) {
                log.error("Could not find device to get alarm: " + error);
                res.sendStatus(500);
            } else if (device) {
                res.send({
                    "enabled" : isAlarmEnabled(device)
                });
            } else {
                res.sendStatus(404);
            }
        });
    })
    .put(function(req, res) {
        if (req.body.enabled == true) {
            var deviceId = parseDeviceId(req.params.device);
            getDevice(deviceId, function (error, device) {
                if (error) {
                    log.error("Could not find device to set alarm: " + error);
                    res.sendStatus(500);
                } else if (device) {
                    setAlarmDevice(device);
                    res.sendStatus(200);
                } else {
                    res.sendStatus(404);
                }
            });
        } else {
            res.sendStatus(200);
        }
    });

// Serve static files from public/
app.use(express.static(__dirname + '/public'));

server.listen(PORT);
log.info('Server listening on port ' + PORT);
