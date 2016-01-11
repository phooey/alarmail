var alarmail = angular.module('alarmail', ['frapontillo.bootstrap-switch']);

alarmail.controller('AlarmController', ['$scope', '$http',
  function ($scope, $http) {
    angular.element(document).ready(function () {
        $('[data-toggle="popover"]').popover();
    });

    $http.get('devices/').success(function(data) {
      $scope.devices = data;
    });

    $http.get('alarm/').success(function(data) {
      $scope.alarm = data;
      $scope.alarmEnabled = data.enabled;
    });

    $scope.getAlarmDevices = function() {
      $http.get('alarm/devices').success(function(data) {
        $scope.alarmDevices = data;
      });
    };

    $scope.getAlarmDevices();

    $http.get('alarm/email/').success(function(data) {
      $scope.emailNotificationEnabled = data.enabled;
      $scope.emailNotificationAddress = data.emailNotificationAddress;
    });

    $http.get('alarm/nma/').success(function(data) {
      $scope.nmaEnabled = data.enabled;
      $scope.nmaApiKey = data.apiKey;
    });

    $scope.alerts = [];

    $scope.addAlert = function(type, title, message) {
      $scope.alerts.push({type: type, title: title, message: message});
    };

    $scope.addErrorAlert = function(message) {
      $scope.addAlert("alert-danger", "Error!", message);
    };

    $scope.removeAlert = function(index) {
      $scope.alerts.splice(index, 1);
    };

    $scope.addAlarmDevice = function(deviceId) {
      $http.put('alarm/devices/' + deviceId, { 'deviceId': deviceId }
      ).then(function successCallback(response) {
          $scope.getAlarmDevices();
        }, function errorCallback(response) {
          $scope.addErrorAlert("Could not add alarm device.");
        });
    };

    $scope.deleteAlarmDevice = function(deviceId) {
      $http.delete('alarm/devices/' + deviceId
      ).then(function successCallback(response) {
          $scope.getAlarmDevices();
        }, function errorCallback(response) {
          $scope.addErrorAlert("Could not remove alarm device.");
        });
    };

    $scope.getAlarmDevice = function(deviceId) {
      for (var i = 0; i < $scope.alarmDevices.length; i++) {
        if ($scope.alarmDevices[i].deviceId == deviceId) {
          return $scope.alarmDevices[i];
        }
      }
      return null;
    };

    $scope.getLastOnForAlarmDevice = function(deviceId) {
      var alarmDevice = $scope.getAlarmDevice(deviceId);
      if (alarmDevice) {
          return alarmDevice.lastOn;
      }
      return "N/A";
    };

    $scope.getFormattedLastOnForAlarmDevice = function(deviceId) {
      var lastOn = $scope.getLastOnForAlarmDevice(deviceId);
      if (lastOn !== "N/A") {
          var d = new Date(lastOn);
          lastOn = d.toLocaleString();
      }
      return lastOn;
    };

    $scope.isAlarmDevice = function(deviceId) {
      if ($scope.alarmDevices === undefined) {
        return false;
      }
      for (var i = 0; i < $scope.alarmDevices.length; i++) {
        if ($scope.alarmDevices[i].deviceId == deviceId) {
          return true;
        }
      }
      return false;
    };

    $scope.setAlarm = function () {
      var enabled = $scope.alarmEnabled;
      $http.put('alarm/', { 'enabled': enabled }
        ).then(function successCallback(response) {
          // Do nothing
        }, function errorCallback(response) {
          var enable = $scope.alarmEnabled ? "enable" : "disable";
          $scope.alarmEnabled = !$scope.alarmEnabled;
          $scope.addErrorAlert("Could not " + enable + " alarm.");
        });
    };

    $scope.setNmaEnabled = function () {
      var enabled = $scope.nmaEnabled;
      $http.put('alarm/nma/enabled/', { "enabled": enabled }
        ).then(function successCallback(response) {
          // Do nothing
        }, function errorCallback(response) {
          var enable = $scope.nmaEnabled ? "enable" : "disable";
          $scope.nmaEnabled = !$scope.nmaEnabled;
          $scope.addErrorAlert("Could not " + enable + " NMA notifications.");
        });
    };

    $scope.setNmaApiKey = function () {
      var apiKey = $scope.nmaApiKey;
      $http.put('alarm/nma/apikey/', { "apiKey": apiKey }
        ).then(function successCallback(response) {
          // Do nothing
        }, function errorCallback(response) {
          $scope.addErrorAlert("Could not set NMA API key.");
        });
    };

    $scope.setEmailNotificationEnabled = function () {
      var enabled = $scope.emailNotificationEnabled;
      $http.put('alarm/email/enabled/', { "enabled": enabled }
        ).then(function successCallback(response) {
          // Do nothing
        }, function errorCallback(response) {
          var enable = $scope.emailNotificationEnabled ? "enable" : "disable";
          $scope.emailNotificationEnabled = !$scope.emailNotificationEnabled;
          $scope.addErrorAlert("Could not " + enable + " email notifications.");
        });
    };

    $scope.setEmailNotificationAddress= function () {
      var emailNotificationAddress = $scope.emailNotificationAddress;
      $http.put('alarm/email/address/',
        { "emailNotificationAddress": emailNotificationAddress }
        ).then(function successCallback(response) {
          // Do nothing
        }, function errorCallback(response) {
          $scope.addErrorAlert("Could not set email notification address.");
        });
    };

    $scope.saveConfiguration= function () {
      $http.put('configuration/'
        ).then(function successCallback(response) {
          // Do nothing
        }, function errorCallback(response) {
          $scope.addErrorAlert("Could not save configuration.");
        });
    };
  }
]);
