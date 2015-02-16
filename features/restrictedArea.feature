Feature: client application logs in with admin role

  @feature @now
  Scenario: client app logs in successfully
    Given a admin user of client app with valid credentials
    When the client app requests log in the protected application with valid credentials
    Then the response status code is 200
    And the response body contains json attribute "accessToken"
    And the response body contains json attribute "refreshToken"
    And the response body contains json attribute "expiresIn"


  @feature @now
  Scenario Outline: A protected admin service needs an accessToken with admin role attribute auth to be called
    Given admin client application with a valid access token
    And a protected service replies to a <METHOD> request with <REQUEST_PAYLOAD> to <PATH> with status <STATUS> and a body <RESPONSE_PAYLOAD>
    When the application makes a <METHOD> with <REQUEST_PAYLOAD> to a protected <PATH>
    Then the response status code is <STATUS>
    And the response body must be <RESPONSE_PAYLOAD>
  Examples:
    | PATH          | METHOD  | STATUS | REQUEST_PAYLOAD | RESPONSE_PAYLOAD       |
    | /api/profile  | GET     | 200    |      {}         |       {"data":[]}      |


  @feature @now
  Scenario Outline: A protected admin service needs an accessToken with admin role attribute auth to be called
    Given admin client application with a valid access token
    And a protected service replies to a <METHOD> request with <REQUEST_PAYLOAD> to <PATH> with status <STATUS> and a body ""
    When the application makes a <METHOD> with <REQUEST_PAYLOAD> to a protected <PATH>
    Then the response status code is <STATUS>
  Examples:
    | PATH          | METHOD  | STATUS | REQUEST_PAYLOAD |
    | /api/profile  | PUT     | 204    |      {}         |


  @feature @now
  Scenario Outline: Client with no admin role request restricted endpoints
    Given a client application with a valid access token
    And a protected service replies to a <METHOD> request with <REQUEST_PAYLOAD> to <PATH> with status <STATUS> and a body <RESPONSE_PAYLOAD>
    When the application makes a <METHOD> with <REQUEST_PAYLOAD> to a protected <PATH>
    Then the response status code is <STATUS>
    And the response body must be <RESPONSE_PAYLOAD>
  Examples:
    | PATH          | METHOD  | STATUS | REQUEST_PAYLOAD | RESPONSE_PAYLOAD        |
    | /api/profile  | GET     | 401    |                 | {"err":"unauthorized"}  |
    | /api/profile  | PUT     | 401    | {"key":"value"} | {"err":"unauthorized"}  |


  @feature @now
  Scenario Outline: Client with no admin role request restricted endpoints
    Given a client application with a valid access token
    And a protected service replies to a <METHOD> request with <REQUEST_PAYLOAD> to <PATH> with status <STATUS> and a body ""
    When the application makes a <METHOD> with <REQUEST_PAYLOAD> to a protected <PATH>
    Then the response status code is <STATUS>

  Examples:
    | PATH          | METHOD  | STATUS | REQUEST_PAYLOAD |
    | /api/profile  | PUT     | 401    | {"key":"value"} |