Feature: client application logins into a protected backend

  Scenario: client app logs in successfully
    Given a user of client app with valid credentials
    When the client app requests log in the protected application with valid credentials
    Then the response status code is 200
    And the response body contains an access token
    And the response body contains a refresh token
    And the response body contains an expiration time in seconds
