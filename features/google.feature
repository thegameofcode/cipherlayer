Feature: A user logs in using Google

  @service
  Scenario: client app request to start Google
    When a user request login with Google account
    Then the response has no error
    And the response status code is 302

  @service
  Scenario: invalid data on callback response
    When the client app receives the Google in callback response
    Then the response has no error
    And the response status code is 302


