Feature: client application logs in into a protected backend

  Scenario: client app logs in successfully
    Given a user of client app with valid credentials
    When the client app requests log in the protected application with valid credentials
    Then the response status code is 200
    And the response body contains json attribute "accessToken"
    And the response body contains json attribute "refreshToken"
    And the response body contains json attribute "expiresIn"

  Scenario: client app logs in send bad credentials
    Given a user of client app with valid credentials
    When the client app requests log in the protected application with invalid credentials
    Then the response status code is 401
    And the response body contains json attribute "err"
    And the response body contains json attribute "des"
