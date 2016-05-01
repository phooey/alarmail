var nodemailer = require('nodemailer');

var EmailHandler = function (log, config) {
    this.log = log;
    this.readConfiguration(config.email);
     
    // Nodemailer configuration
    this.transporter = nodemailer.createTransport(this.nodemailerConfig);
};

// Configuration handling
EmailHandler.prototype.readConfiguration = function(config) {
    this.log.debug("Email handler configuration: " + JSON.stringify(config, null, "  "));
    this.enabled = (config.enabled == true);
    this.emailAddress = config.emailAddress;
    this.nodemailerConfig = config.nodemailerConfig;
}

EmailHandler.prototype.generateConfiguration = function() {
    return { "enabled": this.enabled,
             "emailAddress": this.emailAddress,
             "nodemailerConfig": this.nodemailerConfig
    };
}

EmailHandler.prototype.validConfiguration = function() {
    if (!this.enabled) {
        this.log.info("Email notifications disabled, will not send email notification.");
        return false;
    } else if (!this.emailAddress) {
        this.log.warn("No valid email address configured, can not send email notification.");
        return false;
    } else if (!this.nodemailerConfig) {
        this.log.warn("No valid nodemailer config, can not send email notification.");
        return false;
    }

    return true;
}

// Nodemailer handling
EmailHandler.prototype.sendNotification = function(alarmData) {
    if (this.validConfiguration()) {
        var mailOptions = {
            from: alarmData.title + this.nodemailerConfig.auth.user,
            to: this.emailAddress,
            subject: alarmData.subject,
            text: alarmData.text
        }
        var log = this.log;
        this.transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                return log.error("Could not send email notification: " + error);
            }
            log.info('Sent email notification: ' + info.response);
        });
    }
}

// Getters / Setters
EmailHandler.prototype.getEnabled = function() {
    return this.enabled;
}

EmailHandler.prototype.setEnabled = function(enabled) {
    this.log.info("Setting email notifications enabled to: " + enabled);
    this.enabled = (enabled == true);
}

EmailHandler.prototype.getEmailAddress = function() {
    return this.emailAddress;
}
EmailHandler.prototype.setEmailAddress = function(emailAddress) {
    this.log.info("Setting email notification address to: " + emailAddress);
    this.emailAddress = emailAddress;
}

module.exports = EmailHandler;