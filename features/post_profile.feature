Feature: client application POST a profile to create

  #TODO: update to validate the domain with the first item of the allowedDomains in the config (if it exists)

  
  Scenario Outline: Client post data for a new profile
    Given a protected service replies to a <METHOD> request with <PROTECTED_REQUEST_PAYLOAD> to <PATH> with status <STATUS> and a body <PROTECTED_PAYLOAD>
    And config has no param emailverification
    When the client makes a pass through <METHOD> with the following <PUBLIC_REQUEST_PAYLOAD> in the body
    Then the response status code is 403
    When the client makes a pass through <METHOD> with the following <PUBLIC_REQUEST_PAYLOAD> in the body with a pin header
    Then the response status code is 201
    And the response body contains json attribute "accessToken"
    And the response body contains json attribute "refreshToken"
#    And the response body contains json attribute "expiresIn"

  Examples:
  | METHOD | PATH         | STATUS | PROTECTED_REQUEST_PAYLOAD    | PUBLIC_REQUEST_PAYLOAD                                                                 | PROTECTED_PAYLOAD     |
  | POST   | /api/profile | 201    | { "email" : "valid@a.com" }  | { "email":"valid@a.com", "password":"i2E45678", "phone":"631014231", "country":"ES" }  | { "id" : "a1b2c3d4" } |
