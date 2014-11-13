Feature: reverse proxy protects an applicacion behind cipherlayer

  Scenario Outline: A protected service needs an accessToken auth to be called
    Given a client application with a valid access token
    And protected service replies to a <METHOD> request to <PATH> with status <STATUS> and a body <PAYLOAD>
    When the application makes a <METHOD> to a protected <PATH>
    Then the response status code is <STATUS>
    And the response body must be <PAYLOAD>
    Examples:
    | PATH          | METHOD  | STATUS | PAYLOAD                   |
    | /test/get200  | GET     | 200    | {"m":"GET", "s":"200"}    |
    | /test/post200 | POST    | 200    | {"m":"POST", "s":"200"}   |
