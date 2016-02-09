Feature: A user logs in using LinkedIn

	@service
	Scenario: client app request to start Linked In
		When a user request login with linkedIn account
		Then the response has no error
		And the response status code is 302

	@service
	Scenario: invalid data on callback response
		When the client app receives the Linked in callback response
		Then the response has no error
		And the response status code is 302


