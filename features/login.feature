Feature: client application logs in into a protected backend

  Scenario: client app logs in successfully
    Given a user with valid credentials
    When the user requests log in the protected application with valid credentials
    Then the response status code is 200
    And the response body contains json attribute "accessToken"
    And the response body contains json attribute "refreshToken"
    And the response body contains json attribute "expiresIn"

  Scenario: client app logs in send bad credentials
    Given a user with valid credentials
    When the client app requests log in the protected application with invalid credentials
    Then the response status code is 409
    And the response body contains json attribute "err"

  Scenario: client app logs in with incorrect username
    Given a user with valid credentials
    When the client app requests log in the protected application with username substring
    Then the response status code is 409
    And the response body contains json attribute "err"
