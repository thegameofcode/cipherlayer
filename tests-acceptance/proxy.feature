Feature: reverse proxy protects an applicacion behind cipherlayer

	@service
	Scenario Outline: A protected service needs an accessToken auth to be called
		Given a user with role user and a valid access token
		And a protected service replies to a <METHOD> request with <REQUEST_PAYLOAD> to <PATH> with status <STATUS> and a responseBody <RESPONSE_PAYLOAD>
		When the application makes a <METHOD> with <REQUEST_PAYLOAD> to a protected <PATH>
		Then the response status code is <STATUS>
		And the response body must be <RESPONSE_PAYLOAD>
		Examples:
			| PATH          | METHOD | STATUS | REQUEST_PAYLOAD | RESPONSE_PAYLOAD        |
			| /test/get200  | GET    | 200    |                 | {"m":"GET", "s":"200"}  |
			| /test/post200 | POST   | 200    | {"key":"value"} | {"m":"POST", "s":"200"} |

	@service
	Scenario Outline: A protected service returns a response header
		Given a user with role user and a valid access token
		And a protected service replies to a <METHOD> request with <REQUEST_PAYLOAD> to <PATH> with status <STATUS> and a body <RESPONSE_PAYLOAD> and header <ALLOWED_HEADER> and value <HEADER_VALUE>
		When the application makes a <METHOD> with <REQUEST_PAYLOAD> to a protected <PATH>
		Then the response status code is <STATUS>
		And the response body must be <RESPONSE_PAYLOAD>
		And the response headers contains the <ALLOWED_HEADER> with <HEADER_VALUE>
		Examples:
			| PATH         | METHOD | STATUS | REQUEST_PAYLOAD | RESPONSE_PAYLOAD       | ALLOWED_HEADER  | HEADER_VALUE |
			| /test/get200 | GET    | 200    |                 | {"m":"GET", "s":"200"} | x-custom-header | test         |

	@only
	@service
	Scenario Outline: A call to a public endpoint set on config is allowed to pass
		Given a protected service replies to a public <METHOD> request with <REQUEST_PAYLOAD> to <PATH> with status <STATUS> and a body <RESPONSE_PAYLOAD>
		When the application makes a <METHOD> without credentials <REQUEST_PAYLOAD> to a protected <PATH>
		Then the response status code is <STATUS>
		And the response body must be <RESPONSE_PAYLOAD>
		Examples:
			| PATH         | METHOD | STATUS | REQUEST_PAYLOAD | RESPONSE_PAYLOAD       |
			| /public/path | GET    | 200    |                 | {"m":"GET", "s":"200"} |
