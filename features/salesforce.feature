Feature: A user logs in using SalesForce

  Scenario: client app request to start SalesForce login process
    Given a user with valid credentials in SalesForce linked to SalesForce
    When the client app request to start SalesForce login process
    Then the response status code is 302

  Scenario: client app request to start SalesForce login process
    Given a user with valid credentials in SalesForce not linked to SalesForce
    When the client app request to start SalesForce login process
    Then the response status code is 302

  Scenario: invalid data on callback response
    When the client app receives the SalesForce callback response
    Then the response status code is 302

  @ignore
  Scenario: non-existing user callback response
    Given a user with valid credentials in SalesForce not linked to SalesForce
    When the client app receives the SalesForce callback response
    Then the response status code is 203
    And the response body contains json attribute "name"
    And the response body contains json attribute "email"
    And the response body contains json attribute "phone"
    And the response body contains json attribute "sf"

  Scenario: existing user callback response
    Given a user with valid credentials in SalesForce linked to SalesForce
    When the client app receives the SalesForce callback response
    Then the response status code is 200
    And the response body contains json attribute "accessToken"
    And the response body contains json attribute "refreshToken"
    And the response body contains json attribute "expiresIn"
