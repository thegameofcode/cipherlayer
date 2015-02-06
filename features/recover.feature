Feature: client application requests recover password

  @feature @now
  Scenario Outline: Client request recover password
    Given a user of client app with valid credentials
    When the client makes a <METHOD> request to <PATH>
    Then the response status code is 201

  Examples:
  | METHOD | PATH                       |
  | GET    | /api/user/:email/password  |
