module.exports = function (opts) {
    var mockTelldus = {};

    mockTelldus.TURNON  = 1;
    mockTelldus.TURNOFF = 2;
    mockTelldus.TYPE_DEVICE = 1;
    mockTelldus.on = function () {};

    function MockDevice(id) {
        this.id              = id;
        this.type            = mockTelldus.TYPE_DEVICE;
        this.methods         = mockTelldus.TURNON | mockTelldus.TURNOFF;
        this.lastSentCommand = 0;
        this.name       = 'Mock Device ' + id;
    }

    MockDevice.prototype.turnOn = function (callback) {
        this.lastSentCommand = mockTelldus.TURNON;
        callback(null);
    };

    MockDevice.prototype.turnOff = function (callback) {
        this.lastSentCommand = mockTelldus.TURNOFF;
        callback(null);
    };

    mockTelldus.devices = [];
    numDevices = opts.numDevices || 1;
    for (var i = 1; i <= numDevices; i++) {
        mockTelldus.devices.push(new MockDevice(i));
    }

    mockTelldus.getDevices = function (callback) {
        callback(null, mockTelldus.devices);
    };

    return mockTelldus;
}
