Feature: reverse proxy protects an applicacion behind cipherlayer

  @feature
  Scenario Outline: A protected service needs an accessToken auth to be called
    Given a client application with a valid access token
    And a protected service replies to a <METHOD> request with <REQUEST_PAYLOAD> to <PATH> with status <STATUS> and a body <RESPONSE_PAYLOAD>
    When the application makes a <METHOD> with <REQUEST_PAYLOAD> to a protected <PATH>
    Then the response status code is <STATUS>
    And the response body must be <RESPONSE_PAYLOAD>
    Examples:
    | PATH          | METHOD  | STATUS | REQUEST_PAYLOAD | RESPONSE_PAYLOAD        |
    | /test/get200  | GET     | 200    |                 | {"m":"GET", "s":"200"}  |
    | /test/post200 | POST    | 200    | {"key":"value"} | {"m":"POST", "s":"200"} |
