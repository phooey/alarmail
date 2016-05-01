var nma = require('nma');

var NMAHandler = function (log, config) {
    this.log = log;
    this.readConfiguration(config.nma || {});
};

// Configuration handling
NMAHandler.prototype.readConfiguration = function(config) {
    this.log.debug("NMA handler configuration: " + JSON.stringify(config, null, "  "));
    this.enabled = config.enabled || false;
    this.apiKey = config.apiKey || "";
}

NMAHandler.prototype.generateConfiguration = function() {
    return { "enabled": this.enabled,
             "apiKey": this.apiKey
    };
}

NMAHandler.prototype.validConfiguration = function() {
    if (!this.enabled) {
        return false;
    }
    if (!this.apiKey) {
        this.log.warn("Could not send NMA notification: No NMA API key configured.");
        return false;
    }

    return true;
}

// NMA notification handling
NMAHandler.prototype.sendNotification = function(alarmData) {
    if (this.validConfiguration()) {
        var log = this.log;
        nma({
          "apikey": this.apiKey,
          "application": alarmData.title,
          "event": alarmData.subject,
          "description": alarmData.text,
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
}

// Getters / Setters
NMAHandler.prototype.getEnabled = function() {
    return this.enabled;
}

NMAHandler.prototype.setEnabled = function(enabled) {
    this.log.info("Setting NMA notifications enabled to: " + enabled);
    this.enabled = (enabled == true);
}

NMAHandler.prototype.getApiKey = function() {
    return this.apiKey;
}
NMAHandler.prototype.setApiKey = function(apiKey) {
    this.log.info("Setting NMA API key to: " + apiKey);
    this.apiKey = apiKey;
}

module.exports = NMAHandler;