Feature: client application requests recover password

  @serviceValidCors
  Scenario: client app makes a request with valid origin
    Given a user with valid credentials
    And the user requests log in the protected application with valid credentials
    When the client makes a request with valid origin and headers "custom-header-1,custom-header-2,custom-header-3"
    Then the response status code is 200
    And the response headers contains attribute "Access-Control-Allow-Origin"
    And the response headers contains attribute "Access-Control-Allow-Credentials"
    And the response headers contains attribute "Access-Control-Expose-Headers" which contains the custom headers

    
  @serviceValidCors
  Scenario: client app makes a request with invalid origin
    Given a user with valid credentials
    And the user requests log in the protected application with valid credentials
    When the client makes a request with invalid origin
    Then the response status code is 200
    And the response headers does not contain attribute "Access-Control-Allow-Origin"
    And the response headers does not contain attribute "Access-Control-Allow-Credentials"
    And the response headers does not contain attribute "Access-Control-Expose-Headers"