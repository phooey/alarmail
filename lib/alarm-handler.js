var moment = require('moment');
var shell = require('shelljs');

var AlarmHandler = function (log, config, handlers) {
    this.log = log;
    this.readConfiguration(config.alarm || {});
    this.handlers = handlers || [];
};

// Configuration handling
AlarmHandler.prototype.readConfiguration = function(config) {
    this.log.debug("Alarm handler configuration: " + JSON.stringify(config, null, "  "));
    this.enabled = config.enabled || false;
    this.devices = config.devices || [];
    this.suppressScript = config.suppressScript || "";
}

AlarmHandler.prototype.generateConfiguration = function() {
    var devicesConfig = this.devices.map(function (alarmDevice) {
        return { "deviceId": alarmDevice.deviceId };
    });
    return { "enabled": this.enabled,
             "devices": devicesConfig,
             "suppressScript": this.suppressScript
    };
}

// Alarm handling
AlarmHandler.prototype.handleAlarm = function(alarmData) {
    if (!this.getEnabled()) {
        this.log.info("Alarm disabled, ignoring.")
        return;
    } else if (this.suppressScript) {
        this.log.info("Running suppressScript: ", this.suppressScript);
        var self = this;
        shell.exec(this.suppressScript, {silent: true}, function(code, output) {
            if (code === 0) {
                self.log.info("Alarm suppressed by script.");
            } else {
                self.sendAlarm(alarmData);
            }
        });
    } else {
        this.sendAlarm(alarmData);
    }
}

AlarmHandler.prototype.sendAlarm = function (alarmData) {
    this.log.info("Sending alarm.");
    for (var i = 0; i < this.handlers.length; i++) {
        this.handlers[i].sendNotification(alarmData);
    }
}

// Getters / Setters
AlarmHandler.prototype.getEnabled = function() {
    return this.enabled;
}

AlarmHandler.prototype.setEnabled = function(enabled) {
    this.log.info("Setting alarm enabled to: " + enabled);
    this.enabled = (enabled == true);
}

AlarmHandler.prototype.getDevices = function() {
    return this.devices;
}

AlarmHandler.prototype.getDevice = function(deviceId) {
    for (var i = 0; i < this.devices.length; i++) {
        if (this.devices[i].deviceId == deviceId) {
            return this.devices[i];
        }
    }
    return null;
}

AlarmHandler.prototype.getSerializedDevices = function () {
    return this.devices.map(this.serializeDevice);
}

AlarmHandler.prototype.serializeDevice = function (alarmDevice) {
   var lastOn = (alarmDevice.lastOn) ? alarmDevice.lastOn.format() : "N/A";
    return {
        "deviceId": alarmDevice.deviceId,
        "lastOn":   lastOn
    };
}

AlarmHandler.prototype.getSuppressScript = function() {
    return this.suppressScript;
}

AlarmHandler.prototype.addDevice = function(deviceId) {
    this.log.info("Adding alarm for device with ID: " + deviceId);
    this.devices.push({ "deviceId": deviceId });
}

AlarmHandler.prototype.deleteDevice = function(deviceId) {
    this.log.info("Deleting alarm for device with ID: " + deviceId);
    for (var i = 0; i < this.devices.length; i++) {
        if (this.devices[i].deviceId == deviceId) {
            return this.devices.splice(i, 1);
        }
    }
    return null;
}

AlarmHandler.prototype.isAlarmEnabledForDevice = function(deviceId) {
    for (var i = 0; i < this.devices.length; i++) {
        if (this.devices[i].deviceId == deviceId) {
            return true;
        }
    }
    return false;
}

AlarmHandler.prototype.setLastOnForDevice = function(deviceId) {
    this.log.info("Updating lastOn for device with id: ", deviceId);
    var device = this.getDevice(deviceId);
    device.lastOn = moment();
}

module.exports = AlarmHandler;