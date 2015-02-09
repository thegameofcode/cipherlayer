Feature: client application requests recover password

  @feature @now
  Scenario Outline: Client request recover password
    Given a user of client app with valid credentials
    When the client makes a <METHOD> request to <PATH>
    Then the response status code is 201

  Examples:
  | METHOD | PATH                        |
  | GET    | /user/:email/password       |


  @feature
  Scenario Outline: client app logs in with old password
    Given a user of client app with valid credentials
    When the client makes a <METHOD> request to <PATH>
    Then the response status code is 201
    When the client app requests log in the protected application with valid credentials
    Then the response status code is 200
    And the response body contains json attribute "accessToken"
    And the response body contains json attribute "refreshToken"
    And the response body contains json attribute "expiresIn"

  Examples:
  | METHOD | PATH                        |
  | GET    | /user/:email/password       |
