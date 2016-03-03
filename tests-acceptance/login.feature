Feature: client application logs in into a protected backend

	@service
	Scenario: client app logs in successfully
		Given a user with valid credentials
		When the user requests log in the protected application with valid credentials
		Then the response status code is 200
		And the response body contains json attribute "accessToken"
		And the response body contains json attribute "refreshToken"
		And the response body contains json attribute "expiresIn"

	@service
	Scenario: client app logs in send bad credentials
		Given a user with valid credentials
		When the client app requests log in the protected application with invalid credentials
		Then the response status code is 409
		And the response body contains json attribute "err"

	@service
	Scenario: client app logs in with incorrect username
		Given a user with valid credentials
		When the client app requests log in the protected application with username substring
		Then the response status code is 409
		And the response body contains json attribute "err"

	@service
	Scenario: client app requests a magic link
		Given a user with valid credentials
		When the client app requests a magic link for a valid user
		Then the response status code is 204

	@service
	Scenario: user receives the magic link
		Given a user with valid credentials
		When the client app requests a magic link for a valid user
		Then the user receives a magic link email

	@service
	Scenario: user clicks the magic link
		Given a user with valid credentials
		When the client app requests a magic link for a valid user
		And the user clicks the received magic link
		Then the response status code is 302
		And the response headers contains the header "Location"
