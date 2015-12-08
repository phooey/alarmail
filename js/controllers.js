var alarmail = angular.module('alarmail', ['frapontillo.bootstrap-switch']);

alarmail.controller('AlarmController', ['$scope', '$http',
  function ($scope, $http) {
    angular.element(document).ready(function () {
        $('[data-toggle="popover"]').popover();
    });

    $http.get('devices/').success(function(data) {
      $scope.devices = data;

      for (var i = 0; i < $scope.devices.length; i++) {
        if ($scope.devices[i].alarmEnabled) {
          $scope.selectedDevice = $scope.devices[i];
          break;
        }
      }
    });

    $http.get('alarm/').success(function(data) {
      $scope.alarm = data;
      $scope.alarmEnabled = data.enabled;
    });

    $http.get('alarm/nma/').success(function(data) {
      $scope.nmaEnabled = data.enabled;
      $scope.nmaApiKey = data.apiKey;
    });

    $http.get('alarm/email/').success(function(data) {
      $scope.emailNotificationEnabled = data.enabled;
      $scope.emailNotificationAddress = data.emailNotificationAddress;
    });

    $scope.setAlarmDevice = function() {
      $http.put('devices/' + $scope.selectedDevice.id + "/alarm/", { 'enabled': true });
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
