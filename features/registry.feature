Feature: Registry
  Test registry resources

  Scenario: Discover registry
    Given Authenticated Client starts at root
    And follows rel 'registry'
    And follows rel 'entities'
    Then has L3 Home profile
    And has L3 List Resource profile
    And has links
      | rel                                                  | href                     | title                    |
      | https://level3.rest/patterns/list/editable#add-entry | /registry/register-event | Register an Entity Event |


  Scenario: Register an Event type
    Given Authenticated Client starts at root
    And follows rel 'registry'
    And follows rel 'register'
    Then registers event 'Registration Tested' in entity 'tests'


  Scenario: Examine an entity
    Given Authenticated Client starts at root
    And follows rel 'registry'
    And follows rel 'entities'
    And follows list entry with name 'tests'
    Then has L3 Home profile
    And has L3 List Resource profile
    And has L3 Entry Resource profile
    And has links
      | rel                                                  | href                     | title                    |
      | https://level3.rest/patterns/list/editable#add-entry | /registry/register-event | Register an Entity Event |


  Scenario: Examine an entity event
    Given Authenticated Client starts at root
    And follows rel 'registry'
    And follows rel 'entities'
    And follows list entry with name 'tests'
    And follows list entry with name 'Registration Tested'
    Then has L3 Data profile
    And has L3 Entry Resource profile


  Scenario: Delete an entity event
    Given Authenticated Client starts at root
    And follows rel 'registry'
    And follows rel 'entities'
    And follows list entry with name 'tests'
    And follows list entry with name 'Registration Tested'
    Then deletes the resource
