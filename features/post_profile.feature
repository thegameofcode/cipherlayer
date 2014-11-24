Feature: client application POST a profile to create

  @sprint
  @sprint9
  Scenario Outline: Client post data for a new profile
    Given a protected service replies to a <METHOD> request with <PROTECTED_REQUEST_PAYLOAD> to <PATH> with status <STATUS> and a body <PROTECTED_PAYLOAD>
    When the client makes a pass through <METHOD> with the following <PUBLIC_REQUEST_PAYLOAD> in the body
    Then the response status code is 201
    And the response body contains json attribute "accessToken"
    And the response body contains json attribute "refreshToken"
    And the response body contains json attribute "expiresIn"

  Examples:
  | METHOD | PATH         | STATUS | PROTECTED_REQUEST_PAYLOAD          | PUBLIC_REQUEST_PAYLOAD                                  | PROTECTED_PAYLOAD     |
  | POST   | /api/profile | 201    | { "email" : "valid@my-comms.com" } | { "email":"valid@my-comms.com", "password":"12345678" } | { "id" : "a1b2c3d4" } |
