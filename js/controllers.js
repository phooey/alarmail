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

    $scope.addAlarmDevice = function(deviceId) {
      $http.put('alarm/devices/' + deviceId, { 'deviceId': deviceId }
      ).then(function successCallback(response) {
          $scope.getAlarmDevices();
        }, function errorCallback(response) {
          // TODO: Handle error
        });
    };

    $scope.deleteAlarmDevice = function(deviceId) {
      $http.delete('alarm/devices/' + deviceId
      ).then(function successCallback(response) {
          $scope.getAlarmDevices();
        }, function errorCallback(response) {
          // TODO: Handle error
        });
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
      $http.put('alarm/', { 'enabled': enabled });
    };

    $scope.setNmaEnabled = function () {
      var enabled = $scope.nmaEnabled;
      $http.put('alarm/nma/enabled/', { "enabled": enabled });
    };

    $scope.setNmaApiKey = function () {
      var apiKey = $scope.nmaApiKey;
      $http.put('alarm/nma/apikey/', { "apiKey": apiKey });
    };

    $scope.setEmailNotificationEnabled = function () {
      var enabled = $scope.emailNotificationEnabled;
      $http.put('alarm/email/enabled/', { "enabled": enabled });
    };

    $scope.setEmailNotificationAddress= function () {
      var emailNotificationAddress = $scope.emailNotificationAddress;
      $http.put('alarm/email/address/', { "emailNotificationAddress": emailNotificationAddress });
    };

    $scope.saveConfiguration= function () {
      $http.put('configuration/');
    };
  }
]);
