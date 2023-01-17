Feature: Registry
  Test registry resources

  Scenario: Discover registry
    Given Authenticated Client starts at root
    And follows rels 'registry,entities'
    Then has L3 Home profile
    And has L3 List Resource profile
    And content is HAL
    And has links
      | rel                                                  | href                     | title                    | profile                           |
      | https://level3.rest/patterns/list/editable#add-entry | /registry/register-event | Register an Entity Event | https://level3.rest/profiles/form |


  Scenario: Register an Event type twice is OK
    Given Authenticated Client registers event 'Registration Tested' in entity 'tests'
    Then Authenticated Client registers event 'Registration Tested' in entity 'tests'


  Scenario: Examine an entity
    Given Authenticated Client starts at root
    And follows rels 'registry,entities'
    And follows list entry with name 'tests'
    Then has L3 Home profile
    And has L3 List Resource profile
    And has L3 Entry Resource profile
    And content is HAL
    And has links
      | rel                                                  | href                     | title                    | profile                           |
      | https://level3.rest/patterns/list/editable#add-entry | /registry/register-event | Register an Entity Event | https://level3.rest/profiles/form |


  Scenario: Examine an entity event
    Given Authenticated Client starts at root
    And follows rels 'registry,entities'
    And follows list entry with name 'tests'
    And follows list entry with name 'Registration Tested'
    Then has L3 Data profile
    And has L3 Entry Resource profile
    And content is HAL
    And has links
      | rel           | href    | title             | profile                           |
      | append-event  | /append | Append Events API | https://level3.rest/profiles/form |


  Scenario: Cannot delete an event type when ledger has events using it
    Given Authenticated Client appends fact 'tests/Registration Tested', key 'a', meta '{}' and data '{"msg":"just a test"}'
    And Authenticated Client starts at root
    And follows rels 'registry,entities'
    And follows list entry with name 'tests'
    And follows list entry with name 'Registration Tested'
    Then fails to delete the resource because of status 422


  Scenario: Delete an entity event type
    Given Authenticated Client resets ledger
    And Authenticated Client starts at root
    And follows rels 'registry,entities'
    And follows list entry with name 'tests'
    And follows list entry with name 'Registration Tested'
    Then deletes the resource
