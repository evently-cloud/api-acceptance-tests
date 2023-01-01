Feature: Look Around
  Test the non-authenticated endpoints

  Scenario: Root Resource
    Given Client starts at root
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel       | href          | title                                     | profile                           |
      | append    | /append       | Append events to the ledger.              | https://level3.rest/profiles/home |
      | ledgers   | /ledgers      | Download or reset ledger events.          | https://level3.rest/profiles/home |
      | registry  | /registry     | Register entity events for the ledger.    | https://level3.rest/profiles/home |
      | selectors | /selectors    | Selects events to replay from the ledger. | https://level3.rest/profiles/home |


  #########
  # Append
  #########

  Scenario: Append Resource
    Given Client starts at root
    And follows rel 'append'
    Then content is HAL
    And has L3 Home profile
    And has links
      | rel     | href            | title                                                                                         | profile                           |
      | factual | /append/fact    | Append factual events to a ledger. Factual events cannot be rejected from the ledger.         | https://level3.rest/profiles/form |
      | serial  | /append/serial  | Append event to an entity if no other events have been appended after a known previous event. | https://level3.rest/profiles/form |
      | atomic  | /append/atomic  | Atomically append an event only if a selector has no new events.                              | https://level3.rest/profiles/form |



  Scenario: Append Fact Resource
    Given Client starts at root
    And follows rel 'append'
    And follows rel 'factual'
    Then has L3 Form profile
    And content is JSON Schema


  Scenario: Append Serial Resource
    Given Client starts at root
    And follows rel 'append'
    And follows rel 'serial'
    Then has L3 Form profile
    And content is JSON Schema


  Scenario: Append Atomic Resource
    Given Client starts at root
    And follows rel 'append'
    And follows rel 'atomic'
    Then has L3 Form profile
    And content is JSON Schema


  #########
  # Ledgers
  #########

  Scenario: Ledgers Resource requires Authorization
    Given Client starts at root
    And follows rel 'ledgers'
    Then Client is not authorized



  ##########
  # Registry
  ##########

  Scenario: Registry Resource
    Given Client starts at root
    And follows rel 'registry'
    Then has L3 Home profile
    And content is HAL
    And has links
      | rel       | href                      | title                       | profile                           |
      | register  | /registry/register-event  | Register an Event           | https://level3.rest/profiles/form |
      | entities  | /registry/entities        | Entity and Event Registry   | https://level3.rest/profiles/home |


  Scenario: Register Event Resource
    Given Client starts at root
    And follows rel 'registry'
    And follows rel 'register'
    Then has L3 Form profile
    And has L3 Add Entry Resource profile
    And content is JSON Schema
    And has links
      | rel                                                     | href               | title                            |
      | https://level3.rest/patterns/list/editable#adds-to-list | /registry/entities | Adds event types to this entity. |


  Scenario: Entities Registry Resource requires Authorization
    Given Client starts at root
    And follows rel 'registry'
    And follows rel 'entities'
    Then Client is not authorized


  ###########
  # Selectors
  ###########

  Scenario: Selectors Resource
    Given Client starts at root
    And follows rel 'selectors'
    Then has L3 Home profile
    And content is HAL
    And has links
      | rel    | href              | title                                | profile                           |
      | replay | /selectors/replay | Replay entity events                 | https://level3.rest/profiles/form |
      | filter | /selectors/filter | Filter events by meta and event data | https://level3.rest/profiles/form |


  Scenario: Create Replay Selector Resource requires Authorization
    Given Client starts at root
    And follows rel 'selectors'
    And follows rel 'replay'
    Then Client is not authorized


  Scenario: Create Filter Selector Resource requires Authorization
    Given Client starts at root
    And follows rel 'selectors'
    And follows rel 'filter'
    Then Client is not authorized
