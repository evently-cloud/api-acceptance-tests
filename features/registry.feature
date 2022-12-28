Feature: Registry
  Test registry resources

  Scenario: Discover registry
    Given Authenticated Client starts at root
    And follows rel registry
    And follows rel entities
    Then has L3 Home profile
    And has L3 List Resource profile


  Scenario: Register an Event type
    Given Authenticated Client starts at root
    And follows rel registry
    And follows rel entities
