Feature: client application POST a profile to create

  #TODO: update to validate the domain with the first item of the allowedDomains in the config (if it exists)

  @feature
  Scenario Outline: Client request recover password
    Given a user of client app with valid credentials
    When the client makes a <METHOD> request to <PATH>
    Then the response status code is 201

  Examples:
  | METHOD | PATH                       |
  | GET    | /api/user/:email/password  |
